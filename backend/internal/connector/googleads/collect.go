package googleads

import (
	"context"
	"fmt"
	"time"

	"github.com/rush-maestro/rush-maestro/internal/domain"
	"github.com/rush-maestro/rush-maestro/internal/repository"
)

// MonitoringDefaults applied when the tenant has no ads_monitoring config.
var MonitoringDefaults = domain.AdsMonitoringConfig{
	TargetCPABRL:             100.0,
	NoConversionAlertDays:    3,
	MaxCPAMultiplier:         1.5,
	MinDailyImpressions:      50,
	BudgetUnderpaceThreshold: 0.5,
}

// CollectResult is returned by CollectDailyMetrics.
type CollectResult struct {
	Date               string               `json:"date"`
	CampaignsProcessed int                  `json:"campaigns_processed"`
	Summary            []CampaignCollectRow `json:"summary"`
}

// CampaignCollectRow is a per-campaign summary row in CollectResult.
type CampaignCollectRow struct {
	Campaign    string   `json:"campaign"`
	Cost        string   `json:"cost"`
	Conversions float64  `json:"conversions"`
	Alerts      []string `json:"alerts"`
}

// CollectDailyMetrics fetches Google Ads metrics for targetDate, stores them in
// PostgreSQL, and generates alert_events for WARN/CRITICAL conditions.
func CollectDailyMetrics(
	ctx context.Context,
	client *Client,
	tenant *domain.Tenant,
	targetDate string, // YYYY-MM-DD
	metricsRepo *repository.MetricsRepository,
	alertRepo *repository.AlertRepository,
	agentRunRepo *repository.AgentRunRepository,
) (*CollectResult, error) {
	cfg := MonitoringDefaults
	if tenant.AdsMonitoring != nil {
		m := tenant.AdsMonitoring
		if m.TargetCPABRL > 0 {
			cfg.TargetCPABRL = m.TargetCPABRL
		}
		if m.NoConversionAlertDays > 0 {
			cfg.NoConversionAlertDays = m.NoConversionAlertDays
		}
		if m.MaxCPAMultiplier > 0 {
			cfg.MaxCPAMultiplier = m.MaxCPAMultiplier
		}
		if m.MinDailyImpressions > 0 {
			cfg.MinDailyImpressions = m.MinDailyImpressions
		}
		if m.BudgetUnderpaceThreshold > 0 {
			cfg.BudgetUnderpaceThreshold = m.BudgetUnderpaceThreshold
		}
	}

	// Query 1: all non-removed campaigns (always returns rows, no date filter)
	campaignsRaw, err := client.Query(ctx, `
		SELECT campaign.id, campaign.name, campaign.status,
		       campaign.serving_status, campaign_budget.amount_micros
		FROM campaign WHERE campaign.status != 'REMOVED'
	`)
	if err != nil {
		return nil, err
	}

	// Query 2: metrics for targetDate
	metricsRaw, err := client.Query(ctx, fmt.Sprintf(`
		SELECT campaign.id, metrics.impressions, metrics.clicks,
		       metrics.cost_micros, metrics.conversions
		FROM campaign
		WHERE campaign.status != 'REMOVED' AND segments.date = '%s'
	`, targetDate))
	if err != nil {
		return nil, err
	}

	metricsById := map[string]QueryResult{}
	for _, row := range metricsRaw {
		id := str(row, "campaign", "id")
		metricsById[id] = row
	}

	parsedDate, _ := time.Parse("2006-01-02", targetDate)
	var summary []CampaignCollectRow

	for _, camp := range campaignsRaw {
		campaignID   := str(camp, "campaign", "id")
		campaignName := str(camp, "campaign", "name")
		budgetMicros := num(camp, "campaignBudget", "amountMicros")
		campaignStatus := str(camp, "campaign", "status")

		m := metricsById[campaignID]
		impressions := num(m, "metrics", "impressions")
		clicks      := num(m, "metrics", "clicks")
		costMicros  := num(m, "metrics", "costMicros")
		conversions := num(m, "metrics", "conversions")

		// Query 3: last 7 days history for no-conversion streak detection
		hist7Start := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
		hist7End   := time.Now().Format("2006-01-02")
		historyRaw, _ := client.Query(ctx, fmt.Sprintf(`
			SELECT segments.date, campaign.status, campaign.serving_status,
			       metrics.impressions, metrics.conversions
			FROM campaign
			WHERE campaign.id = %s
			  AND segments.date BETWEEN '%s' AND '%s'
			ORDER BY segments.date DESC
		`, campaignID, hist7Start, hist7End))

		var alerts []string

		if mapCampaignStatus(campaignStatus) == "ENABLED" {
			// no_conversions_streak: count consecutive ENABLED days with impressions but no conversions
			streak := 0
			for _, h := range historyRaw {
				if mapCampaignStatus(str(h, "campaign", "status")) == "ENABLED" &&
					num(h, "metrics", "impressions") > 0 {
					if num(h, "metrics", "conversions") > 0 {
						break
					}
					streak++
				}
			}
			if streak >= cfg.NoConversionAlertDays {
				level := "WARN"
				if streak >= cfg.NoConversionAlertDays*2 {
					level = "CRITICAL"
				}
				msg := fmt.Sprintf("%d days without conversion", streak)
				alerts = append(alerts, fmt.Sprintf("[%s] no_conversions_streak: %s", level, msg))
				_ = alertRepo.Create(ctx, repository.AlertEvent{
					ID:           domain.NewID(),
					TenantID:     tenant.ID,
					Level:        level,
					Type:         "no_conversions_streak",
					CampaignID:   &campaignID,
					CampaignName: &campaignName,
					Message:      msg,
				})
			}

			// high_cpa
			if conversions > 0 {
				cpaBRL := fromMicros(costMicros) / conversions
				if cpaBRL > cfg.TargetCPABRL*cfg.MaxCPAMultiplier {
					pct := (cpaBRL/cfg.TargetCPABRL - 1) * 100
					msg := fmt.Sprintf("CPA R$%.2f — %.0f%% above target (R$%.2f)", cpaBRL, pct, cfg.TargetCPABRL)
					alerts = append(alerts, "[WARN] high_cpa: "+msg)
					_ = alertRepo.Create(ctx, repository.AlertEvent{
						ID:           domain.NewID(),
						TenantID:     tenant.ID,
						Level:        "WARN",
						Type:         "high_cpa",
						CampaignID:   &campaignID,
						CampaignName: &campaignName,
						Message:      msg,
					})
				}
			}

			// budget_underpace (INFO — no alert_event row)
			if budgetMicros > 0 && impressions > 0 {
				pace := costMicros / budgetMicros
				if pace < cfg.BudgetUnderpaceThreshold {
					alerts = append(alerts, fmt.Sprintf(
						"[INFO] budget_underpace: pacing %.0f%%", pace*100))
				}
			}

			// low_impressions (INFO)
			if impressions > 0 && impressions < float64(cfg.MinDailyImpressions) {
				alerts = append(alerts, fmt.Sprintf(
					"[INFO] low_impressions: %.0f impressions", impressions))
			}
		}

		// Compute derived metrics
		var cpaBRL *float64
		if conversions > 0 {
			v := fromMicros(costMicros) / conversions
			cpaBRL = &v
		}
		var ctr *float64
		if impressions > 0 {
			v := clicks / impressions
			ctr = &v
		}

		_ = metricsRepo.UpsertDaily(ctx, repository.DailyMetric{
			ID:           domain.NewID(),
			TenantID:     tenant.ID,
			Date:         parsedDate,
			CampaignID:   campaignID,
			CampaignName: campaignName,
			Impressions:  int32(impressions),
			Clicks:       int32(clicks),
			CostBRL:      fromMicros(costMicros),
			Conversions:  conversions,
			CPABRL:       cpaBRL,
			CTR:          ctr,
		})

		summary = append(summary, CampaignCollectRow{
			Campaign:    campaignName,
			Cost:        fmt.Sprintf("R$%.2f", fromMicros(costMicros)),
			Conversions: conversions,
			Alerts:      alerts,
		})
	}

	_ = agentRunRepo.Log(ctx, tenant.ID, "collect_daily_metrics", "success",
		fmt.Sprintf("date=%s campaigns=%d", targetDate, len(summary)))

	return &CollectResult{
		Date:               targetDate,
		CampaignsProcessed: len(summary),
		Summary:            summary,
	}, nil
}
