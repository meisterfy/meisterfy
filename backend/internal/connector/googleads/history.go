package googleads

import (
	"context"
	"fmt"
	"time"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/repository"
)

// SyncHistoryResult summarizes the outcome of SyncHistory.
type SyncHistoryResult struct {
	From string `json:"from"`
	To   string `json:"to"`
	Rows int    `json:"rows"`
}

// SyncHistory fetches the last `days` days of metrics for all non-removed campaigns
// using a single GAQL query and upserts each (campaign, date) row into daily_metrics.
func SyncHistory(
	ctx context.Context,
	client *Client,
	tenant *domain.Tenant,
	days int,
	metricsRepo *repository.MetricsRepository,
) (*SyncHistoryResult, error) {
	to := time.Now().AddDate(0, 0, -1) // yesterday — today's data is incomplete
	from := to.AddDate(0, 0, -(days - 1))
	fromStr, toStr := from.Format("2006-01-02"), to.Format("2006-01-02")

	rows, err := client.Query(ctx, fmt.Sprintf(`
		SELECT campaign.id, campaign.name,
		       metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
		       segments.date
		FROM campaign
		WHERE campaign.status != 'REMOVED'
		  AND segments.date BETWEEN '%s' AND '%s'
		ORDER BY segments.date
	`, fromStr, toStr))
	if err != nil {
		return nil, err
	}

	count := 0
	for _, row := range rows {
		dateStr := str(row, "segments", "date")
		parsedDate, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}
		impressions := num(row, "metrics", "impressions")
		clicks := num(row, "metrics", "clicks")
		costMicros := num(row, "metrics", "costMicros")
		conversions := num(row, "metrics", "conversions")

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
			CampaignID:   str(row, "campaign", "id"),
			CampaignName: str(row, "campaign", "name"),
			Impressions:  int32(impressions),
			Clicks:       int32(clicks),
			CostBRL:      fromMicros(costMicros),
			Conversions:  conversions,
			CPABRL:       cpaBRL,
			CTR:          ctr,
		})
		count++
	}

	return &SyncHistoryResult{From: fromStr, To: toStr, Rows: count}, nil
}
