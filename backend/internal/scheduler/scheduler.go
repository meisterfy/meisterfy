package scheduler

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	"github.com/mkt-maestro/mkt-maestro/internal/connector/googleads"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/provider/llm"
	"github.com/mkt-maestro/mkt-maestro/internal/repository"
)

// AdsClientFactory builds a Google Ads client for a given tenant.
// Same signature as mcptools.AdsClientFactory — pass the same function to both.
type AdsClientFactory func(ctx context.Context, tenantID string) (*googleads.Client, *domain.Tenant, error)

// Scheduler runs periodic jobs for all tenants based on their AdsMonitoringConfig flags.
// Config is stored in Postgres (ads_monitoring JSONB); run history is logged to agent_runs.
type Scheduler struct {
	tenantRepo  interface {
		List(ctx context.Context) ([]*domain.Tenant, error)
	}
	agentRunRepo *repository.AgentRunRepository
	metricsRepo  *repository.MetricsRepository
	adsFactory   AdsClientFactory
	llmSelector  *llm.ProviderSelector
}

func New(
	tenantRepo interface{ List(ctx context.Context) ([]*domain.Tenant, error) },
	agentRunRepo *repository.AgentRunRepository,
	metricsRepo *repository.MetricsRepository,
	adsFactory AdsClientFactory,
	llmSelector *llm.ProviderSelector,
) *Scheduler {
	return &Scheduler{
		tenantRepo:   tenantRepo,
		agentRunRepo: agentRunRepo,
		metricsRepo:  metricsRepo,
		adsFactory:   adsFactory,
		llmSelector:  llmSelector,
	}
}

// Start launches the background loop. Call once from main, pass the server context so it
// shuts down cleanly when the server stops.
func (s *Scheduler) Start(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	// Run once at startup so a freshly deployed server picks up any missed jobs.
	s.tick(ctx, time.Now().UTC())

	for {
		select {
		case <-ctx.Done():
			return
		case t := <-ticker.C:
			s.tick(ctx, t.UTC())
		}
	}
}

func (s *Scheduler) tick(ctx context.Context, now time.Time) {
	tenants, err := s.tenantRepo.List(ctx)
	if err != nil {
		slog.Error("scheduler: list tenants", "err", err)
		return
	}

	for _, tenant := range tenants {
		cfg := tenant.AdsMonitoring
		if cfg == nil {
			continue
		}

		t := tenant // capture loop var

		// Daily sync: 02:00 UTC (23:00 BRT)
		if cfg.SyncEnabled && now.Hour() == 2 && now.Minute() == 0 {
			go s.runSync(ctx, t)
		}

		// Daily AI report: 06:00 UTC (03:00 BRT)
		if cfg.AIReportDaily && now.Hour() == 6 && now.Minute() == 0 {
			go s.runAIReport(ctx, t, "daily")
		}

		// Weekly AI report: Monday 07:00 UTC
		if cfg.AIReportWeekly && now.Weekday() == time.Monday && now.Hour() == 7 && now.Minute() == 0 {
			go s.runAIReport(ctx, t, "weekly")
		}

		// Monthly AI report: 1st of month 08:00 UTC
		if cfg.AIReportMonthly && now.Day() == 1 && now.Hour() == 8 && now.Minute() == 0 {
			go s.runAIReport(ctx, t, "monthly")
		}
	}
}

// agentName returns a canonical agent name for a given job type.
func agentName(jobType string) string {
	return "scheduler/" + jobType
}

// alreadyRanToday returns true if the job ran successfully today (UTC) — prevents double runs.
func (s *Scheduler) alreadyRanToday(ctx context.Context, tenantID, jobType string) bool {
	run, err := s.agentRunRepo.GetLast(ctx, tenantID, agentName(jobType))
	if err != nil || run == nil {
		return false
	}
	return run.Status == "success" &&
		run.StartedAt.UTC().Format("2006-01-02") == time.Now().UTC().Format("2006-01-02")
}

// runSync pulls yesterday's Google Ads data into daily_metrics.
func (s *Scheduler) runSync(ctx context.Context, tenant *domain.Tenant) {
	const jobType = "ads_sync_daily"
	if s.alreadyRanToday(ctx, tenant.ID, jobType) {
		return
	}

	jobCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	client, _, err := s.adsFactory(jobCtx, tenant.ID)
	if err != nil {
		slog.Warn("scheduler: ads_sync_daily — no ads client", "tenant", tenant.ID, "err", err)
		return
	}

	result, err := googleads.SyncHistory(jobCtx, client, tenant, 2, s.metricsRepo) // yesterday only
	if err != nil {
		slog.Error("scheduler: ads_sync_daily failed", "tenant", tenant.ID, "err", err)
		_ = s.agentRunRepo.Log(ctx, tenant.ID, agentName(jobType), "error", err.Error())
		return
	}

	summary := fmt.Sprintf("Synced %d rows from %s to %s", result.Rows, result.From, result.To)
	_ = s.agentRunRepo.Log(ctx, tenant.ID, agentName(jobType), "success", summary)
	slog.Info("scheduler: ads_sync_daily done", "tenant", tenant.ID, "rows", result.Rows)
}

// runAIReport generates an automated AI campaign report and stores it in agent_runs.summary.
func (s *Scheduler) runAIReport(ctx context.Context, tenant *domain.Tenant, period string) {
	jobType := "ai_report_" + period
	if s.alreadyRanToday(ctx, tenant.ID, jobType) {
		return
	}

	jobCtx, cancel := context.WithTimeout(ctx, 15*time.Minute)
	defer cancel()

	// Resolve LLM provider.
	providerName, integration, err := s.llmSelector.Resolve(jobCtx, tenant.ID)
	if err != nil {
		slog.Warn("scheduler: "+jobType+" — no llm provider", "tenant", tenant.ID)
		return
	}

	apiKey := integration.LLMCredentials()
	if apiKey == nil || *apiKey == "" {
		slog.Warn("scheduler: "+jobType+" — llm missing credentials", "tenant", tenant.ID)
		return
	}

	provider, err := llm.NewProvider(providerName, *apiKey, integration.Config)
	if err != nil {
		slog.Error("scheduler: "+jobType+" — create provider", "err", err)
		return
	}

	// Build Google Ads client.
	client, _, err := s.adsFactory(jobCtx, tenant.ID)
	if err != nil {
		slog.Warn("scheduler: "+jobType+" — no ads client", "tenant", tenant.ID, "err", err)
		return
	}

	// Determine date window.
	endDate := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	var startDate string
	switch period {
	case "weekly":
		startDate = time.Now().UTC().AddDate(0, 0, -7).Format("2006-01-02")
	case "monthly":
		startDate = time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02")
	default: // daily
		startDate = time.Now().UTC().AddDate(0, 0, -7).Format("2006-01-02")
	}

	// Get all active campaigns.
	campaigns, err := client.GetLiveMetrics(jobCtx)
	if err != nil {
		slog.Error("scheduler: "+jobType+" — get campaigns", "tenant", tenant.ID, "err", err)
		_ = s.agentRunRepo.Log(ctx, tenant.ID, agentName(jobType), "error", err.Error())
		return
	}

	var reports []string
	for _, campaign := range campaigns {
		if campaign.Status != "ENABLED" {
			continue
		}
		// Zero-balance guard: skip campaigns with no impressions this period.
		if campaign.Impressions == "0" || campaign.Impressions == "" {
			continue
		}

		reportText, err := s.generateCampaignReport(jobCtx, provider, client, campaign, tenant, startDate, endDate, period)
		if err != nil {
			slog.Warn("scheduler: "+jobType+" — generate report", "tenant", tenant.ID, "campaign", campaign.ID, "err", err)
			continue
		}
		reports = append(reports, fmt.Sprintf("## %s\n\n%s", campaign.Name, reportText))
	}

	if len(reports) == 0 {
		summary := fmt.Sprintf("No active campaigns with data for period %s–%s", startDate, endDate)
		_ = s.agentRunRepo.Log(ctx, tenant.ID, agentName(jobType), "success", summary)
		return
	}

	title := strings.ToUpper(period[:1]) + period[1:]
	fullReport := fmt.Sprintf("# AI Report — %s (%s to %s)\n\n", title, startDate, endDate) +
		strings.Join(reports, "\n\n---\n\n")

	_ = s.agentRunRepo.Log(ctx, tenant.ID, agentName(jobType), "success", fullReport)
	slog.Info("scheduler: "+jobType+" done", "tenant", tenant.ID, "campaigns", len(reports))
}

func (s *Scheduler) generateCampaignReport(
	ctx context.Context,
	provider domain.LLMProvider,
	client *googleads.Client,
	campaign googleads.CampaignMetric,
	tenant *domain.Tenant,
	startDate, endDate, period string,
) (string, error) {
	detail, err := client.GetCampaignDetail(ctx, campaign.ID, startDate, endDate)
	if err != nil {
		return "", fmt.Errorf("get detail: %w", err)
	}

	terms, err := client.GetSearchTerms(ctx, campaign.ID, startDate, endDate)
	if err != nil {
		terms = nil // non-fatal
	}

	kw, err := client.GetKeywordPerformance(ctx, campaign.ID, startDate, endDate)
	if err != nil {
		kw = nil
	}

	qs, err := client.GetKeywordQualityScores(ctx, campaign.ID)
	if err != nil {
		qs = nil
	}

	prompt := buildReportPrompt(detail, terms, kw, qs, period)

	maxTokens := 2048
	if period == "monthly" {
		maxTokens = 4096
	}

	resp, err := provider.Generate(ctx, domain.LLMRequest{
		TenantID:  tenant.ID,
		TaskType:  "campaign_report",
		System:    reportSystemPrompt(period),
		Messages:  []domain.Message{{Role: domain.RoleUser, Content: prompt}},
		MaxTokens: maxTokens,
		Temperature: 0.4,
	}, nil)
	if err != nil {
		return "", fmt.Errorf("generate: %w", err)
	}
	if resp == nil {
		return "", fmt.Errorf("empty response")
	}
	return resp.Content, nil
}

func reportSystemPrompt(period string) string {
	base := "You are a senior Google Ads strategist. Analyze the campaign data and provide actionable insights in markdown. Be specific and data-driven."
	switch period {
	case "weekly":
		return base + " This is a weekly deep-dive: compare this week vs prior week trends, identify what changed and why."
	case "monthly":
		return base + " This is a monthly critical report: be dense, detailed, and strategic. Cover full funnel, structural issues, budget allocation, and a prioritized 30-day action plan."
	default:
		return base + " This is a daily performance check: focus on anomalies, yesterday vs 7-day average, and immediate action items."
	}
}

func buildReportPrompt(
	d *googleads.CampaignDetail,
	terms []googleads.SearchTermRow,
	kw []googleads.KeywordPerfRow,
	qs []googleads.KeywordQSRow,
	period string,
) string {
	budget := d.BudgetMicros / 1_000_000

	sort.Slice(terms, func(i, j int) bool { return terms[i].Clicks > terms[j].Clicks })
	topTerms := ""
	for i, t := range terms {
		if i >= 10 {
			break
		}
		topTerms += fmt.Sprintf("- %q | clicks: %.0f | cost: R$%.2f | conv: %.0f | CTR: %.1f%%\n",
			t.Term, t.Clicks, t.Cost, t.Conversions, t.CTR*100)
	}

	sort.Slice(kw, func(i, j int) bool { return kw[i].Cost > kw[j].Cost })
	topKw := ""
	for i, k := range kw {
		if i >= 10 {
			break
		}
		topKw += fmt.Sprintf("- [%s] %q | %s | cost: R$%.2f | CPA: R$%.2f | conv: %.0f\n",
			k.MatchType, k.KeywordText, k.AdGroupName, k.Cost, k.CPA, k.Conversions)
	}

	lowQS := ""
	for i, k := range qs {
		if k.QualityScore > 5 || k.QualityScore == 0 {
			continue
		}
		if i >= 5 {
			break
		}
		lowQS += fmt.Sprintf("- %q QS: %d/10 | CTR: %s | Creative: %s | Landing: %s\n",
			k.KeywordText, k.QualityScore, k.PredictedCTR, k.CreativeQS, k.PostClickQS)
	}

	if topTerms == "" {
		topTerms = "(none)"
	}
	if topKw == "" {
		topKw = "(none)"
	}
	if lowQS == "" {
		lowQS = "(none found)"
	}

	m := d.Metrics
	periodLabel := map[string]string{"daily": "7 days", "weekly": "7 days", "monthly": "30 days"}[period]

	return fmt.Sprintf(`Campaign: %s
Period: last %s | Status: %s | Strategy: %s | Budget: R$%.2f/day

METRICS:
- Impressions: %s | Clicks: %s | Cost: R$%s | CPA: R$%s | Conversions: %s
- Search Impression Share: %s

TOP SEARCH TERMS BY CLICKS:
%s
TOP KEYWORDS BY SPEND:
%s
LOW QUALITY SCORE KEYWORDS (≤5):
%s`,
		d.Name, periodLabel, d.Status, d.Strategy, budget,
		m.Impressions, m.Clicks, m.Cost, m.CPA, m.Conversions, m.SearchImpressionShare,
		topTerms, topKw, lowQS,
	)
}
