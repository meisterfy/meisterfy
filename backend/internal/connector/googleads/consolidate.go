package googleads

import (
	"context"
	"fmt"
	"time"

	"github.com/rush-maestro/rush-maestro/internal/domain"
	"github.com/rush-maestro/rush-maestro/internal/repository"
)

// ConsolidateResult is returned by ConsolidateMonthly.
type ConsolidateResult struct {
	Month              string               `json:"month"`
	CampaignsProcessed int                  `json:"campaigns_processed"`
	Results            []CampaignMonthlyRow `json:"results"`
}

// CampaignMonthlyRow is a per-campaign summary row in ConsolidateResult.
type CampaignMonthlyRow struct {
	CampaignID  string  `json:"campaign_id"`
	Cost        string  `json:"cost"`
	Conversions float64 `json:"conversions"`
	Clicks      int32   `json:"clicks"`
	Impressions int32   `json:"impressions"`
	DaysActive  int     `json:"days_active"`
	CPA         string  `json:"cpa"`
}

// ConsolidateMonthly aggregates daily_metrics for targetMonth into monthly_summary.
// Does NOT call Google Ads API — reads from PostgreSQL only.
// targetMonth format: "YYYY-MM"
func ConsolidateMonthly(
	ctx context.Context,
	tenantID string,
	targetMonth string,
	metricsRepo *repository.MetricsRepository,
	agentRunRepo *repository.AgentRunRepository,
) (*ConsolidateResult, error) {
	start, err := time.Parse("2006-01", targetMonth)
	if err != nil {
		return nil, fmt.Errorf("invalid month format: %s", targetMonth)
	}
	end := start.AddDate(0, 1, 0)

	days, err := metricsRepo.GetHistory(ctx, tenantID, start)
	if err != nil {
		return nil, err
	}

	// Filter to targetMonth only (GetHistory returns from start to now)
	var monthDays []repository.DailyMetric
	for _, d := range days {
		if !d.Date.Before(start) && d.Date.Before(end) {
			monthDays = append(monthDays, d)
		}
	}

	if len(monthDays) == 0 {
		_ = agentRunRepo.Log(ctx, tenantID, "consolidate_monthly", "success",
			fmt.Sprintf("month=%s no_data", targetMonth))
		return &ConsolidateResult{Month: targetMonth, CampaignsProcessed: 0}, nil
	}

	type campaignAgg struct {
		name        string
		totalCost   float64
		totalConv   float64
		totalClicks int32
		totalImpr   int32
		daysActive  int
	}
	byID := map[string]*campaignAgg{}
	for _, d := range monthDays {
		agg := byID[d.CampaignID]
		if agg == nil {
			agg = &campaignAgg{name: d.CampaignName}
			byID[d.CampaignID] = agg
		}
		agg.totalCost += d.CostBRL
		agg.totalConv += d.Conversions
		agg.totalClicks += d.Clicks
		agg.totalImpr += d.Impressions
		if d.Impressions > 0 {
			agg.daysActive++
		}
	}

	var results []CampaignMonthlyRow
	for campaignID, agg := range byID {
		var avgCPA *float64
		cpaStr := "N/A"
		if agg.totalConv > 0 {
			v := agg.totalCost / agg.totalConv
			avgCPA = &v
			cpaStr = fmt.Sprintf("R$%.2f", v)
		}

		_ = metricsRepo.UpsertMonthly(ctx, repository.MonthlySummary{
			ID:           domain.NewID(),
			TenantID:     tenantID,
			Month:        targetMonth,
			CampaignID:   campaignID,
			CampaignName: agg.name,
			Impressions:  agg.totalImpr,
			Clicks:       agg.totalClicks,
			CostBRL:      agg.totalCost,
			Conversions:  agg.totalConv,
			AvgCPABRL:    avgCPA,
		})

		results = append(results, CampaignMonthlyRow{
			CampaignID:  campaignID,
			Cost:        fmt.Sprintf("R$%.2f", agg.totalCost),
			Conversions: agg.totalConv,
			Clicks:      agg.totalClicks,
			Impressions: agg.totalImpr,
			DaysActive:  agg.daysActive,
			CPA:         cpaStr,
		})
	}

	_ = agentRunRepo.Log(ctx, tenantID, "consolidate_monthly", "success",
		fmt.Sprintf("month=%s campaigns=%d", targetMonth, len(results)))

	return &ConsolidateResult{
		Month:              targetMonth,
		CampaignsProcessed: len(results),
		Results:            results,
	}, nil
}
