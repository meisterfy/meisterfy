package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	"github.com/meisterfy/meisterfy/internal/adjuster"
	"github.com/meisterfy/meisterfy/internal/connector/googleads"
	"github.com/meisterfy/meisterfy/internal/connector/social"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/provider/llm"
	"github.com/meisterfy/meisterfy/internal/repository"
)

// AdsClientFactory builds a Google Ads client for a given tenant.
// Same signature as mcptools.AdsClientFactory — pass the same function to both.
type AdsClientFactory func(ctx context.Context, tenantID string) (*googleads.Client, *domain.Tenant, error)

// Scheduler runs periodic jobs for all tenants based on their AdsMonitoringConfig flags.
// Config is stored in Postgres (ads_monitoring JSONB); run history is logged to agent_runs.
type Scheduler struct {
	tenantRepo interface {
		List(ctx context.Context) ([]*domain.Tenant, error)
	}
	agentRunRepo     *repository.AgentRunRepository
	metricsRepo      *repository.MetricsRepository
	adsFactory       AdsClientFactory
	llmSelector      *llm.ProviderSelector
	adjuster         *adjuster.Engine
	pendingAdjRepo   *repository.PendingAdjustmentRepository
	auditLogRepo     *repository.AuditLogRepository
	alertRepo        *repository.AlertRepository
	connResourceRepo *repository.ConnectorResourceRepository
	postRepo         interface {
		ListDueScheduledPosts(ctx context.Context) ([]*domain.Post, error)
		UpdateStatus(ctx context.Context, id, tenantID, status string, publishedAt *time.Time) error
	}
	publishResultRepo *repository.PostPublishResultRepository
	postInsightRepo   *repository.PostInsightRepository
}

func New(
	tenantRepo interface{ List(ctx context.Context) ([]*domain.Tenant, error) },
	agentRunRepo *repository.AgentRunRepository,
	metricsRepo *repository.MetricsRepository,
	adsFactory AdsClientFactory,
	llmSelector *llm.ProviderSelector,
	adj *adjuster.Engine,
	pendingAdjRepo *repository.PendingAdjustmentRepository,
	auditLogRepo *repository.AuditLogRepository,
	alertRepo *repository.AlertRepository,
	connResourceRepo *repository.ConnectorResourceRepository,
	postRepo interface {
		ListDueScheduledPosts(ctx context.Context) ([]*domain.Post, error)
		UpdateStatus(ctx context.Context, id, tenantID, status string, publishedAt *time.Time) error
	},
	publishResultRepo *repository.PostPublishResultRepository,
	postInsightRepo *repository.PostInsightRepository,
) *Scheduler {
	return &Scheduler{
		tenantRepo:        tenantRepo,
		agentRunRepo:      agentRunRepo,
		metricsRepo:       metricsRepo,
		adsFactory:        adsFactory,
		llmSelector:       llmSelector,
		adjuster:          adj,
		pendingAdjRepo:    pendingAdjRepo,
		auditLogRepo:      auditLogRepo,
		alertRepo:         alertRepo,
		connResourceRepo:  connResourceRepo,
		postRepo:          postRepo,
		publishResultRepo: publishResultRepo,
		postInsightRepo:   postInsightRepo,
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

		// Daily campaign adjustment / suggestions: 03:00 UTC (00:00 BRT)
		if (cfg.AdjustmentsEnabled || cfg.SuggestionsEnabled) && now.Hour() == 3 && now.Minute() == 0 {
			go s.runAdjustmentJob(ctx, t)
		}
	}

	// Publish due scheduled posts — runs every minute, no per-tenant guard needed.
	go s.runScheduledPosts(ctx)

	// Insights sync — 05:00 UTC, global scan across all tenants.
	if now.Hour() == 5 && now.Minute() == 0 {
		go s.runInsightsSync(ctx)
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

func (s *Scheduler) runAdjustmentJob(ctx context.Context, tenant *domain.Tenant) {
	const jobType = "campaign_adjustment"
	if s.alreadyRanToday(ctx, tenant.ID, jobType) {
		return
	}

	jobCtx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()

	cfg := tenant.AdsMonitoring

	if _, err := s.pendingAdjRepo.ExpireOld(jobCtx); err != nil {
		slog.Warn("scheduler: campaign_adjustment — expire old", "tenant", tenant.ID, "err", err)
	}

	resources, err := s.connResourceRepo.List(jobCtx, tenant.ID, domain.ProviderGoogleAds, "campaign")
	if err != nil {
		slog.Error("scheduler: campaign_adjustment — list resources", "tenant", tenant.ID, "err", err)
		_ = s.agentRunRepo.Log(ctx, tenant.ID, agentName(jobType), "error", err.Error())
		return
	}

	var adsClient *googleads.Client
	if cfg.AdjustmentsEnabled {
		client, _, clientErr := s.adsFactory(jobCtx, tenant.ID)
		if clientErr != nil {
			slog.Warn("scheduler: campaign_adjustment — no ads client", "tenant", tenant.ID, "err", clientErr)
		} else {
			adsClient = client
		}
	}

	var applied, suggested, failed int

	for _, res := range resources {
		proposal, evalErr := s.adjuster.Evaluate(jobCtx, *res, *cfg)
		if evalErr != nil {
			slog.Error("scheduler: campaign_adjustment — evaluate", "tenant", tenant.ID, "resource", res.ID, "err", evalErr)
			failed++
			continue
		}
		if proposal == nil {
			continue
		}

		if cfg.AdjustmentsEnabled {
			if adsClient == nil {
				campaignID := res.ResourceID
				_ = s.alertRepo.Create(ctx, repository.AlertEvent{
					ID:           domain.NewID(),
					TenantID:     tenant.ID,
					Level:        "CRITICAL",
					Type:         "adjustment_failed",
					CampaignID:   &campaignID,
					CampaignName: res.ResourceName,
					Message:      "Campaign adjustment failed: no Google Ads client available",
				})
				failed++
				continue
			}
			if mutErr := s.applyMutation(jobCtx, adsClient, res, proposal); mutErr != nil {
				slog.Error("scheduler: campaign_adjustment — mutate", "tenant", tenant.ID, "resource", res.ID, "err", mutErr)
				campaignID := res.ResourceID
				_ = s.alertRepo.Create(ctx, repository.AlertEvent{
					ID:           domain.NewID(),
					TenantID:     tenant.ID,
					Level:        "CRITICAL",
					Type:         "adjustment_failed",
					CampaignID:   &campaignID,
					CampaignName: res.ResourceName,
					Message:      fmt.Sprintf("Campaign adjustment failed: %v", mutErr),
				})
				failed++
				continue
			}

			_ = s.auditLogRepo.Log(jobCtx, domain.AuditEntry{
				TenantID:   tenant.ID,
				Action:     "campaign_auto_adjusted",
				EntityType: "connector_resource",
				EntityID:   res.ID,
				EntityName: res.ResourceName,
				After: map[string]any{
					"type":           string(proposal.Type),
					"current_value":  proposal.CurrentValue,
					"proposed_value": proposal.ProposedValue,
					"reason":         proposal.Reason,
				},
			})

			res.Metadata["last_adjusted_at"] = time.Now().UTC().Format(time.RFC3339)
			if metaErr := s.connResourceRepo.UpdateMetadata(jobCtx, res.ID, res.Metadata); metaErr != nil {
				slog.Warn("scheduler: campaign_adjustment — update metadata", "resource", res.ID, "err", metaErr)
			}

			expiresAt := time.Now().UTC().AddDate(0, 0, 30)
			_, _ = s.pendingAdjRepo.CreateApplied(jobCtx, repository.CreatePendingAdjustmentParams{
				TenantID:           tenant.ID,
				CampaignResourceID: res.ID,
				AdjustmentType:     string(proposal.Type),
				CurrentValue:       proposal.CurrentValue,
				ProposedValue:      proposal.ProposedValue,
				Reason:             proposal.Reason,
				ExpiresAt:          &expiresAt,
			})
			applied++

		} else if cfg.SuggestionsEnabled {
			intervalDays := cfg.EffectiveAdjustmentIntervalDays()
			expiresAt := time.Now().UTC().AddDate(0, 0, intervalDays)
			adj, createErr := s.pendingAdjRepo.Create(jobCtx, repository.CreatePendingAdjustmentParams{
				TenantID:           tenant.ID,
				CampaignResourceID: res.ID,
				AdjustmentType:     string(proposal.Type),
				CurrentValue:       proposal.CurrentValue,
				ProposedValue:      proposal.ProposedValue,
				Reason:             proposal.Reason,
				ExpiresAt:          &expiresAt,
			})
			if createErr != nil {
				slog.Error("scheduler: campaign_adjustment — create suggestion", "resource", res.ID, "err", createErr)
				failed++
				continue
			}

			campaignID := res.ResourceID
			var campaignNameStr string
			if res.ResourceName != nil {
				campaignNameStr = *res.ResourceName
			}
			details, _ := json.Marshal(map[string]any{
				"campaign_name":         campaignNameStr,
				"adjustment_type":       string(proposal.Type),
				"current_value":         proposal.CurrentValue,
				"proposed_value":        proposal.ProposedValue,
				"reason":                proposal.Reason,
				"pending_adjustment_id": adj.ID,
			})
			_ = s.alertRepo.Create(ctx, repository.AlertEvent{
				ID:           domain.NewID(),
				TenantID:     tenant.ID,
				Level:        "INFO",
				Type:         "adjustment_suggestion",
				CampaignID:   &campaignID,
				CampaignName: res.ResourceName,
				Message:      fmt.Sprintf("Campaign adjustment suggested: %s from %.2f to %.2f", proposal.Type, proposal.CurrentValue, proposal.ProposedValue),
				Details:      details,
			})
			suggested++
		}
	}

	status := "success"
	if failed > 0 && applied == 0 && suggested == 0 {
		status = "error"
	}
	summary := fmt.Sprintf("applied=%d suggested=%d failed=%d resources=%d", applied, suggested, failed, len(resources))
	_ = s.agentRunRepo.Log(ctx, tenant.ID, agentName(jobType), status, summary)
	slog.Info("scheduler: campaign_adjustment done", "tenant", tenant.ID, "applied", applied, "suggested", suggested, "failed", failed)
}

func (s *Scheduler) runScheduledPosts(ctx context.Context) {
	posts, err := s.postRepo.ListDueScheduledPosts(ctx)
	if err != nil {
		slog.Error("scheduler: runScheduledPosts — list due posts", "err", err)
		return
	}
	for _, post := range posts {
		p := post
		go s.publishPost(ctx, p)
	}
}

func (s *Scheduler) publishPost(ctx context.Context, post *domain.Post) {
	jobCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	// Deduplication guard: skip if a publish was already attempted for this post.
	exists, err := s.publishResultRepo.ExistsForPost(jobCtx, post.ID)
	if err != nil {
		slog.Error("scheduler: publishPost — check exists", "post_id", post.ID, "err", err)
		return
	}
	if exists {
		return
	}

	// Group platforms by provider so each provider's resource is resolved once.
	providerGroups := map[domain.IntegrationProvider][]social.Platform{}
	for _, p := range post.Platforms {
		platform := social.Platform(p)
		provider, ok := social.PlatformProvider[platform]
		if !ok {
			slog.Warn("scheduler: publishPost — unknown platform", "post_id", post.ID, "platform", p)
			continue
		}
		providerGroups[provider] = append(providerGroups[provider], platform)
	}

	if len(providerGroups) == 0 {
		slog.Warn("scheduler: publishPost — no known platforms", "post_id", post.ID, "tenant_id", post.TenantID)
		_ = s.postRepo.UpdateStatus(jobCtx, post.ID, post.TenantID, string(domain.PostStatusFailed), nil)
		return
	}

	var published, failed int

	for provider, platforms := range providerGroups {
		var resource *domain.ConnectorResource

		if post.ConnectorResourceID != nil {
			resource, err = s.connResourceRepo.GetByID(jobCtx, *post.ConnectorResourceID)
			if err != nil {
				slog.Error("scheduler: publishPost — get resource by id", "post_id", post.ID, "resource_id", *post.ConnectorResourceID, "err", err)
				resource = nil
			}
		}

		if resource == nil {
			resources, listErr := s.connResourceRepo.List(jobCtx, post.TenantID, provider, "page")
			if listErr != nil || len(resources) == 0 {
				errMsg := "no connector resource available"
				if listErr != nil {
					errMsg = listErr.Error()
				}
				for _, platform := range platforms {
					_ = s.publishResultRepo.Create(jobCtx, repository.CreatePublishResultParams{
						ID:           domain.NewID(),
						PostID:       post.ID,
						Platform:     string(platform),
						Provider:     string(provider),
						Status:       "failed",
						ErrorMessage: &errMsg,
					})
					failed++
				}
				slog.Error("scheduler: publishPost — no resource", "post_id", post.ID, "tenant_id", post.TenantID, "provider", provider)
				continue
			}
			resource = resources[0]
		}

		publisher := social.Get(provider)
		if publisher == nil {
			errMsg := "provider not registered"
			for _, platform := range platforms {
				_ = s.publishResultRepo.Create(jobCtx, repository.CreatePublishResultParams{
					ID:           domain.NewID(),
					PostID:       post.ID,
					Platform:     string(platform),
					Provider:     string(provider),
					Status:       "failed",
					ErrorMessage: &errMsg,
				})
				failed++
			}
			slog.Error("scheduler: publishPost — provider not registered", "post_id", post.ID, "provider", provider)
			continue
		}

		for _, platform := range platforms {
			result, pubErr := publisher.Publish(jobCtx, platform, resource, post)
			if pubErr != nil {
				errMsg := pubErr.Error()
				slog.Error("scheduler: publishPost — publish failed", "post_id", post.ID, "tenant_id", post.TenantID, "platform", platform, "err", pubErr)
				_ = s.publishResultRepo.Create(jobCtx, repository.CreatePublishResultParams{
					ID:           domain.NewID(),
					PostID:       post.ID,
					Platform:     string(platform),
					Provider:     string(provider),
					Status:       "failed",
					ErrorMessage: &errMsg,
				})
				failed++
				continue
			}

			now := time.Now().UTC()
			externalID := result.ExternalID
			_ = s.publishResultRepo.Create(jobCtx, repository.CreatePublishResultParams{
				ID:          domain.NewID(),
				PostID:      post.ID,
				Platform:    string(platform),
				Provider:    string(provider),
				ExternalID:  &externalID,
				Status:      "published",
				PublishedAt: &now,
			})
			published++
			slog.Info("scheduler: publishPost — published", "post_id", post.ID, "tenant_id", post.TenantID, "platform", platform, "external_id", externalID)
		}
	}

	now := time.Now().UTC()
	var finalStatus string
	var publishedAt *time.Time
	switch {
	case failed == 0:
		finalStatus = string(domain.PostStatusPublished)
		publishedAt = &now
	case published == 0:
		finalStatus = string(domain.PostStatusFailed)
	default:
		finalStatus = string(domain.PostStatusPartiallyPublished)
		publishedAt = &now
	}
	if err := s.postRepo.UpdateStatus(jobCtx, post.ID, post.TenantID, finalStatus, publishedAt); err != nil {
		slog.Error("scheduler: publishPost — update status", "post_id", post.ID, "err", err)
	}
}

func (s *Scheduler) runInsightsSync(ctx context.Context) {
	now := time.Now().UTC()

	windows := []struct {
		name   string
		minAge time.Duration
		maxAge time.Duration
	}{
		{"24h", 23 * time.Hour, 48 * time.Hour},
		{"7d", 6 * 24 * time.Hour, 14 * 24 * time.Hour},
		{"30d", 29 * 24 * time.Hour, 60 * 24 * time.Hour},
	}

	for _, w := range windows {
		publishedAfter := now.Add(-w.maxAge)
		publishedBefore := now.Add(-w.minAge)

		results, err := s.postInsightRepo.ListPendingSync(ctx, w.name, publishedAfter, publishedBefore)
		if err != nil {
			slog.Error("insights_sync: list pending", "window", w.name, "err", err)
			continue
		}

		slog.Info("insights_sync: syncing window", "window", w.name, "count", len(results))
		for _, result := range results {
			s.syncInsight(ctx, result, w.name)
			time.Sleep(100 * time.Millisecond) // respect Meta rate limits
		}
	}
}

func (s *Scheduler) syncInsight(ctx context.Context, result *domain.PostPublishResult, window string) {
	if result.ExternalID == nil {
		return
	}

	jobCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	provider, ok := social.PlatformProvider[social.Platform(result.Platform)]
	if !ok {
		slog.Warn("insights_sync: unknown platform", "platform", result.Platform, "publish_result_id", result.ID)
		return
	}

	publisher := social.Get(provider)
	if publisher == nil {
		return
	}

	resource, err := s.connResourceRepo.GetDefaultForTenant(jobCtx, result.TenantID, provider)
	if err != nil || resource == nil {
		slog.Warn("insights_sync: no resource", "tenant_id", result.TenantID, "platform", result.Platform, "err", err)
		return
	}

	raw, err := publisher.FetchInsights(jobCtx, social.Platform(result.Platform), resource, *result.ExternalID)
	if err != nil {
		slog.Warn("insights_sync: fetch failed", "platform", result.Platform, "window", window, "external_id", *result.ExternalID, "err", err)
		return
	}

	metrics, _ := raw["metrics"].(map[string]any)
	rawResp, _ := raw["raw"].(map[string]any)
	if metrics == nil {
		metrics = map[string]any{}
	}
	if rawResp == nil {
		rawResp = map[string]any{}
	}

	if err := s.postInsightRepo.Upsert(jobCtx, repository.UpsertInsightParams{
		ID:              domain.NewID(),
		PublishResultID: result.ID,
		PostID:          result.PostID,
		Platform:        result.Platform,
		Window:          window,
		Metrics:         metrics,
		RawResponse:     rawResp,
	}); err != nil {
		slog.Error("insights_sync: upsert failed", "publish_result_id", result.ID, "window", window, "err", err)
	}
}

func (s *Scheduler) applyMutation(ctx context.Context, client *googleads.Client, res *domain.ConnectorResource, proposal *adjuster.Proposal) error {
	switch proposal.Type {
	case adjuster.BidIncrease, adjuster.BidDecrease:
		return client.UpdateTargetCPA(ctx, res.ResourceID, proposal.ProposedValue)
	case adjuster.BudgetIncrease, adjuster.BudgetDecrease:
		budgetID, _ := res.Metadata["budget_id"].(string)
		if budgetID == "" {
			return fmt.Errorf("budget_id missing from campaign metadata (resource %s)", res.ID)
		}
		return client.UpdateBudget(ctx, budgetID, proposal.ProposedValue)
	default:
		return fmt.Errorf("unknown adjustment type: %s", proposal.Type)
	}
}
