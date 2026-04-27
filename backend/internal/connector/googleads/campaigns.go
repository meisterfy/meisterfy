package googleads

import (
	"context"
	"fmt"
	"time"
)

// CampaignMetric is returned by GetLiveMetrics.
type CampaignMetric struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Status      string `json:"status"`
	Impressions string `json:"impressions"`
	Clicks      string `json:"clicks"`
	Cost        string `json:"cost"` // "R$123.45"
}

// SearchTerm is returned by GetSearchTerms.
type SearchTerm struct {
	Term        string  `json:"term"`
	Status      string  `json:"status"`
	Impressions float64 `json:"impressions"`
	Clicks      float64 `json:"clicks"`
	Cost        string  `json:"cost"` // "R$12.34"
	Conversions float64 `json:"conversions"`
}

// AdGroupRow is returned by GetAdGroups.
type AdGroupRow struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Status       string  `json:"status"`
	ResourceName string  `json:"resource_name"`
	Impressions  float64 `json:"impressions"`
	Clicks       float64 `json:"clicks"`
	Cost         string  `json:"cost"`
	Conversions  float64 `json:"conversions"`
}

// GetLiveMetrics returns current campaign metrics (no date filter — shows account status).
func (c *Client) GetLiveMetrics(ctx context.Context) ([]CampaignMetric, error) {
	rows, err := c.Query(ctx, `
		SELECT campaign.id, campaign.name, campaign.status,
		       metrics.impressions, metrics.clicks, metrics.cost_micros
		FROM campaign
		WHERE campaign.status != 'REMOVED'
		ORDER BY campaign.name
		LIMIT 50
	`)
	if err != nil {
		return nil, err
	}

	result := make([]CampaignMetric, len(rows))
	for i, row := range rows {
		result[i] = CampaignMetric{
			ID:          str(row, "campaign", "id"),
			Name:        str(row, "campaign", "name"),
			Status:      mapCampaignStatus(str(row, "campaign", "status")),
			Impressions: str(row, "metrics", "impressions"),
			Clicks:      str(row, "metrics", "clicks"),
			Cost:        fmt.Sprintf("R$%.2f", fromMicros(num(row, "metrics", "costMicros"))),
		}
	}
	return result, nil
}

// GetCriteria returns all criteria for a campaign (keywords, ad schedule, locations, devices).
func (c *Client) GetCriteria(ctx context.Context, campaignID string) ([]map[string]any, error) {
	rows, err := c.Query(ctx, fmt.Sprintf(`
		SELECT
		    campaign_criterion.criterion_id,
		    campaign_criterion.type,
		    campaign_criterion.negative,
		    campaign_criterion.bid_modifier,
		    campaign_criterion.keyword.text,
		    campaign_criterion.keyword.match_type,
		    campaign_criterion.ad_schedule.day_of_week,
		    campaign_criterion.ad_schedule.start_hour,
		    campaign_criterion.ad_schedule.end_hour,
		    campaign_criterion.location.geo_target_constant,
		    campaign_criterion.device.type
		FROM campaign_criterion
		WHERE campaign.id = %s
	`, campaignID))
	if err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		if cc, ok := row["campaignCriterion"].(map[string]any); ok {
			result = append(result, cc)
		}
	}
	return result, nil
}

// GetSearchTerms returns the search terms report for a campaign over the last N days.
func (c *Client) GetSearchTerms(ctx context.Context, campaignID string, days int) ([]SearchTerm, error) {
	since := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	until := time.Now().Format("2006-01-02")
	rows, err := c.Query(ctx, fmt.Sprintf(`
		SELECT
		    search_term_view.search_term,
		    search_term_view.status,
		    metrics.impressions,
		    metrics.clicks,
		    metrics.cost_micros,
		    metrics.conversions
		FROM search_term_view
		WHERE campaign.id = %s
		  AND segments.date BETWEEN '%s' AND '%s'
		ORDER BY metrics.impressions DESC
		LIMIT 100
	`, campaignID, since, until))
	if err != nil {
		return nil, err
	}

	result := make([]SearchTerm, len(rows))
	for i, row := range rows {
		result[i] = SearchTerm{
			Term:        str(row, "searchTermView", "searchTerm"),
			Status:      str(row, "searchTermView", "status"),
			Impressions: num(row, "metrics", "impressions"),
			Clicks:      num(row, "metrics", "clicks"),
			Cost:        fmt.Sprintf("R$%.2f", fromMicros(num(row, "metrics", "costMicros"))),
			Conversions: num(row, "metrics", "conversions"),
		}
	}
	return result, nil
}

// GetAdGroups returns ad groups with metrics for a campaign over the last N days.
func (c *Client) GetAdGroups(ctx context.Context, campaignID string, days int) ([]AdGroupRow, error) {
	since := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	until := time.Now().Format("2006-01-02")
	rows, err := c.Query(ctx, fmt.Sprintf(`
		SELECT
		    ad_group.id,
		    ad_group.name,
		    ad_group.status,
		    ad_group.resource_name,
		    metrics.impressions,
		    metrics.clicks,
		    metrics.cost_micros,
		    metrics.conversions
		FROM ad_group
		WHERE campaign.id = %s
		  AND segments.date BETWEEN '%s' AND '%s'
		ORDER BY metrics.impressions DESC
	`, campaignID, since, until))
	if err != nil {
		return nil, err
	}

	result := make([]AdGroupRow, len(rows))
	for i, row := range rows {
		result[i] = AdGroupRow{
			ID:           str(row, "adGroup", "id"),
			Name:         str(row, "adGroup", "name"),
			Status:       str(row, "adGroup", "status"),
			ResourceName: str(row, "adGroup", "resourceName"),
			Impressions:  num(row, "metrics", "impressions"),
			Clicks:       num(row, "metrics", "clicks"),
			Cost:         fmt.Sprintf("R$%.2f", fromMicros(num(row, "metrics", "costMicros"))),
			Conversions:  num(row, "metrics", "conversions"),
		}
	}
	return result, nil
}

func mapCampaignStatus(raw string) string {
	switch raw {
	case "2", "ENABLED":
		return "ENABLED"
	case "3", "PAUSED":
		return "PAUSED"
	case "4", "REMOVED":
		return "REMOVED"
	default:
		return raw
	}
}
