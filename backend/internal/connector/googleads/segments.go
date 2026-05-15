package googleads

import (
	"context"
	"fmt"
	"time"
)

// DeviceRow holds aggregated metrics for one device type.
type DeviceRow struct {
	Device      string  `json:"device"`
	Cost        float64 `json:"cost"`
	Conversions float64 `json:"conversions"`
	Clicks      float64 `json:"clicks"`
	Impressions float64 `json:"impressions"`
	CPA         float64 `json:"cpa"`
	CTR         float64 `json:"ctr"`
}

// HourlyRow holds aggregated metrics for one hour of the day.
type HourlyRow struct {
	Hour        int     `json:"hour"`
	Cost        float64 `json:"cost"`
	Conversions float64 `json:"conversions"`
	Clicks      float64 `json:"clicks"`
	Impressions float64 `json:"impressions"`
}

// ImpressionShareStats holds impression share breakdown.
type ImpressionShareStats struct {
	WonShare   float64 `json:"wonShare"`
	LostBudget float64 `json:"lostBudget"`
	LostRank   float64 `json:"lostRank"`
}

func defaultDateRange(startDate, endDate string) (string, string) {
	if startDate == "" {
		startDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}
	return startDate, endDate
}

// DaysToDateRange converts a number of days into startDate/endDate strings (YYYY-MM-DD).
func DaysToDateRange(days int) (string, string) {
	end := time.Now()
	start := end.AddDate(0, 0, -days)
	return start.Format("2006-01-02"), end.Format("2006-01-02")
}

// GetDeviceBreakdown returns cost/conversion/click/impression metrics aggregated by device.
// Only DESKTOP, MOBILE, TABLET are included (others filtered if impressions == 0).
func (c *Client) GetDeviceBreakdown(ctx context.Context, campaignID, startDate, endDate string) ([]DeviceRow, error) {
	if err := validateCampaignID(campaignID); err != nil {
		return nil, err
	}
	startDate, endDate = defaultDateRange(startDate, endDate)
	if err := validateDate(startDate); err != nil {
		return nil, err
	}
	if err := validateDate(endDate); err != nil {
		return nil, err
	}

	rows, err := c.Query(ctx, fmt.Sprintf(`
		SELECT segments.device,
		       metrics.cost_micros, metrics.conversions, metrics.clicks, metrics.impressions
		FROM campaign
		WHERE campaign.id = %s
		  AND segments.date BETWEEN '%s' AND '%s'
		ORDER BY segments.device
	`, campaignID, startDate, endDate))
	if err != nil {
		return nil, fmt.Errorf("device breakdown query: %w", err)
	}

	totals := map[string]*DeviceRow{}
	for _, row := range rows {
		device := str(row, "segments", "device")
		if _, ok := totals[device]; !ok {
			totals[device] = &DeviceRow{Device: device}
		}
		d := totals[device]
		d.Cost += fromMicros(num(row, "metrics", "costMicros"))
		d.Conversions += num(row, "metrics", "conversions")
		d.Clicks += num(row, "metrics", "clicks")
		d.Impressions += num(row, "metrics", "impressions")
	}

	keep := []string{"DESKTOP", "MOBILE", "TABLET"}
	result := make([]DeviceRow, 0, 3)
	for _, device := range keep {
		d, ok := totals[device]
		if !ok {
			continue
		}
		if d.Impressions == 0 {
			continue
		}
		if d.Conversions > 0 {
			d.CPA = d.Cost / d.Conversions
		}
		if d.Impressions > 0 {
			d.CTR = (d.Clicks / d.Impressions) * 100
		}
		result = append(result, *d)
	}
	return result, nil
}

// GetHourlyBreakdown returns metrics aggregated by hour of day (0–23).
// Always returns exactly 24 rows; hours with no data have zero values.
func (c *Client) GetHourlyBreakdown(ctx context.Context, campaignID, startDate, endDate string) ([]HourlyRow, error) {
	if err := validateCampaignID(campaignID); err != nil {
		return nil, err
	}
	startDate, endDate = defaultDateRange(startDate, endDate)
	if err := validateDate(startDate); err != nil {
		return nil, err
	}
	if err := validateDate(endDate); err != nil {
		return nil, err
	}

	rows, err := c.Query(ctx, fmt.Sprintf(`
		SELECT segments.hour,
		       metrics.cost_micros, metrics.conversions, metrics.clicks, metrics.impressions
		FROM campaign
		WHERE campaign.id = %s
		  AND segments.date BETWEEN '%s' AND '%s'
		ORDER BY segments.hour
	`, campaignID, startDate, endDate))
	if err != nil {
		return nil, fmt.Errorf("hourly breakdown query: %w", err)
	}

	slots := make([]HourlyRow, 24)
	for i := range slots {
		slots[i].Hour = i
	}

	for _, row := range rows {
		hour := int(num(row, "segments", "hour"))
		if hour < 0 || hour > 23 {
			continue
		}
		slots[hour].Cost += fromMicros(num(row, "metrics", "costMicros"))
		slots[hour].Conversions += num(row, "metrics", "conversions")
		slots[hour].Clicks += num(row, "metrics", "clicks")
		slots[hour].Impressions += num(row, "metrics", "impressions")
	}
	return slots, nil
}

// GetImpressionShare returns averaged impression share stats for the period.
// Returns nil if there are no valid rows.
func (c *Client) GetImpressionShare(ctx context.Context, campaignID, startDate, endDate string) (*ImpressionShareStats, error) {
	if err := validateCampaignID(campaignID); err != nil {
		return nil, err
	}
	startDate, endDate = defaultDateRange(startDate, endDate)
	if err := validateDate(startDate); err != nil {
		return nil, err
	}
	if err := validateDate(endDate); err != nil {
		return nil, err
	}

	rows, err := c.Query(ctx, fmt.Sprintf(`
		SELECT metrics.search_impression_share,
		       metrics.search_budget_lost_impression_share,
		       metrics.search_rank_lost_impression_share
		FROM campaign
		WHERE campaign.id = %s
		  AND segments.date BETWEEN '%s' AND '%s'
	`, campaignID, startDate, endDate))
	if err != nil {
		return nil, fmt.Errorf("impression share query: %w", err)
	}

	var wonSum, budgetSum, rankSum float64
	var count int
	for _, row := range rows {
		won := num(row, "metrics", "searchImpressionShare")
		budget := num(row, "metrics", "searchBudgetLostImpressionShare")
		rank := num(row, "metrics", "searchRankLostImpressionShare")
		if won == 0 && budget == 0 && rank == 0 {
			continue
		}
		wonSum += won
		budgetSum += budget
		rankSum += rank
		count++
	}

	if count == 0 {
		return nil, nil
	}
	return &ImpressionShareStats{
		WonShare:   wonSum / float64(count),
		LostBudget: budgetSum / float64(count),
		LostRank:   rankSum / float64(count),
	}, nil
}
