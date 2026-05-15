package googleads

import (
	"context"
	"fmt"
	"time"
)

// CampaignDetail is returned by GetCampaignDetail.
type CampaignDetail struct {
	ID           string               `json:"id"`
	Name         string               `json:"name"`
	Status       string               `json:"status"`
	Strategy     string               `json:"strategy"`
	BudgetMicros float64              `json:"budgetMicros"`
	Metrics      CampaignDetailStats  `json:"metrics"`
	History      []CampaignHistoryPt  `json:"history"`
	AdGroups     []AdGroupRow         `json:"adGroups"`
}

// CampaignDetailStats holds formatted metric strings for the campaign detail page.
type CampaignDetailStats struct {
	Impressions          string `json:"impressions"`
	Clicks               string `json:"clicks"`
	Cost                 string `json:"cost"`
	Conversions          string `json:"conversions"`
	CPA                  string `json:"cpa"`
	CTR                  string `json:"ctr"`
	SearchImpressionShare string `json:"searchImpressionShare"`
}

// CampaignHistoryPt is one point in the API performance chart.
type CampaignHistoryPt struct {
	Date        string  `json:"date"`
	Clicks      float64 `json:"clicks"`
	Impressions float64 `json:"impressions"`
}

// WoWMetrics holds week-over-week comparison data.
type WoWMetrics struct {
	Cur  WoWPeriod `json:"cur"`
	Prev WoWPeriod `json:"prev"`
}

// WoWPeriod holds raw numeric metrics for one 7-day window.
type WoWPeriod struct {
	Impressions float64 `json:"impressions"`
	Clicks      float64 `json:"clicks"`
	Cost        float64 `json:"cost"`
	Conversions float64 `json:"conversions"`
}

// BudgetPacingInfo describes today's spend vs the daily budget.
type BudgetPacingInfo struct {
	Date   string  `json:"date"`
	Cost   float64 `json:"cost"`
	Budget float64 `json:"budget"`
	Pct    float64 `json:"pct"`
}

// GetCampaignDetail fetches full campaign detail from the Google Ads API.
// If startDate/endDate are empty, defaults to the last 180 days.
func (c *Client) GetCampaignDetail(ctx context.Context, campaignID, startDate, endDate string) (*CampaignDetail, error) {
	if err := validateCampaignID(campaignID); err != nil {
		return nil, err
	}
	if startDate == "" {
		startDate = time.Now().AddDate(0, 0, -180).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}
	if err := validateDate(startDate); err != nil {
		return nil, err
	}
	if err := validateDate(endDate); err != nil {
		return nil, err
	}

	histRows, err := c.Query(ctx, fmt.Sprintf(`
		SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type,
		       campaign_budget.amount_micros,
		       metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
		       metrics.search_impression_share,
		       segments.date
		FROM campaign
		WHERE campaign.id = %s
		  AND segments.date BETWEEN '%s' AND '%s'
		ORDER BY segments.date
	`, campaignID, startDate, endDate))
	if err != nil {
		return nil, err
	}

	// If no rows for the period, fetch just campaign metadata (no date filter).
	if len(histRows) == 0 {
		metaRows, err := c.Query(ctx, fmt.Sprintf(`
			SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type,
			       campaign_budget.amount_micros
			FROM campaign WHERE campaign.id = %s
		`, campaignID))
		if err != nil || len(metaRows) == 0 {
			return nil, fmt.Errorf("campaign %s not found", campaignID)
		}
		r := metaRows[0]
		return &CampaignDetail{
			ID:           campaignID,
			Name:         str(r, "campaign", "name"),
			Status:       mapCampaignStatus(str(r, "campaign", "status")),
			Strategy:     str(r, "campaign", "biddingStrategyType"),
			BudgetMicros: num(r, "campaignBudget", "amountMicros"),
			Metrics:      CampaignDetailStats{CPA: "—", CTR: "—", Conversions: "0", SearchImpressionShare: "—"},
			History:      []CampaignHistoryPt{},
			AdGroups:     []AdGroupRow{},
		}, nil
	}

	// Aggregate totals and build per-day history for the chart.
	var totalImp, totalClicks, totalCostMicros, totalConversions, totalSIS float64
	var sisCount int
	var history []CampaignHistoryPt

	first := histRows[0]
	budgetMicros := num(first, "campaignBudget", "amountMicros")
	name := str(first, "campaign", "name")
	status := mapCampaignStatus(str(first, "campaign", "status"))
	strategy := str(first, "campaign", "biddingStrategyType")

	for _, row := range histRows {
		imp := num(row, "metrics", "impressions")
		clks := num(row, "metrics", "clicks")
		cost := num(row, "metrics", "costMicros")
		conv := num(row, "metrics", "conversions")
		sis := num(row, "metrics", "searchImpressionShare")
		date := str(row, "segments", "date")

		totalImp += imp
		totalClicks += clks
		totalCostMicros += cost
		totalConversions += conv
		if sis > 0 {
			totalSIS += sis
			sisCount++
		}
		history = append(history, CampaignHistoryPt{Date: date, Clicks: clks, Impressions: imp})
	}

	totalCostBRL := fromMicros(totalCostMicros)
	stats := CampaignDetailStats{
		Impressions: fmt.Sprintf("%.0f", totalImp),
		Clicks:      fmt.Sprintf("%.0f", totalClicks),
		Cost:        fmt.Sprintf("R$%.2f", totalCostBRL),
		Conversions: fmt.Sprintf("%.1f", totalConversions),
	}
	if totalConversions > 0 {
		stats.CPA = fmt.Sprintf("R$%.2f", totalCostBRL/totalConversions)
	} else {
		stats.CPA = "—"
	}
	if totalImp > 0 {
		stats.CTR = fmt.Sprintf("%.2f%%", (totalClicks/totalImp)*100)
	} else {
		stats.CTR = "—"
	}
	if sisCount > 0 {
		stats.SearchImpressionShare = fmt.Sprintf("%.0f%%", (totalSIS/float64(sisCount))*100)
	} else {
		stats.SearchImpressionShare = "—"
	}

	adGroups, _ := c.GetAdGroups(ctx, campaignID, daysBetween(startDate, endDate))
	if adGroups == nil {
		adGroups = []AdGroupRow{}
	}

	return &CampaignDetail{
		ID:           campaignID,
		Name:         name,
		Status:       status,
		Strategy:     strategy,
		BudgetMicros: budgetMicros,
		Metrics:      stats,
		History:      history,
		AdGroups:     adGroups,
	}, nil
}

// GetWoW returns week-over-week comparison: last 7 days vs the previous 7 days.
func (c *Client) GetWoW(ctx context.Context, campaignID string) (*WoWMetrics, error) {
	if err := validateCampaignID(campaignID); err != nil {
		return nil, err
	}
	today := time.Now()
	curEnd := today.AddDate(0, 0, -1).Format("2006-01-02")
	curStart := today.AddDate(0, 0, -7).Format("2006-01-02")
	prevEnd := today.AddDate(0, 0, -8).Format("2006-01-02")
	prevStart := today.AddDate(0, 0, -14).Format("2006-01-02")

	sumPeriod := func(start, end string) (WoWPeriod, error) {
		rows, err := c.Query(ctx, fmt.Sprintf(`
			SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
			       segments.date
			FROM campaign
			WHERE campaign.id = %s
			  AND segments.date BETWEEN '%s' AND '%s'
		`, campaignID, start, end))
		if err != nil {
			return WoWPeriod{}, err
		}
		var p WoWPeriod
		for _, row := range rows {
			p.Impressions += num(row, "metrics", "impressions")
			p.Clicks += num(row, "metrics", "clicks")
			p.Cost += fromMicros(num(row, "metrics", "costMicros"))
			p.Conversions += num(row, "metrics", "conversions")
		}
		return p, nil
	}

	cur, err := sumPeriod(curStart, curEnd)
	if err != nil {
		return nil, err
	}
	prev, err := sumPeriod(prevStart, prevEnd)
	if err != nil {
		return nil, err
	}
	return &WoWMetrics{Cur: cur, Prev: prev}, nil
}

// GetBudgetPacing returns today's spend vs the daily budget for a campaign.
// Returns nil if there's no data for today yet.
func (c *Client) GetBudgetPacing(ctx context.Context, campaignID string) (*BudgetPacingInfo, error) {
	if err := validateCampaignID(campaignID); err != nil {
		return nil, err
	}
	today := time.Now().Format("2006-01-02")
	rows, err := c.Query(ctx, fmt.Sprintf(`
		SELECT campaign_budget.amount_micros, metrics.cost_micros, segments.date
		FROM campaign
		WHERE campaign.id = %s
		  AND segments.date = '%s'
	`, campaignID, today))
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	row := rows[0]
	budget := fromMicros(num(row, "campaignBudget", "amountMicros"))
	cost := fromMicros(num(row, "metrics", "costMicros"))
	pct := 0.0
	if budget > 0 {
		pct = cost / budget
	}
	return &BudgetPacingInfo{Date: today, Cost: cost, Budget: budget, Pct: pct}, nil
}

// daysBetween returns the number of days between two YYYY-MM-DD date strings (inclusive).
func daysBetween(start, end string) int {
	s, _ := time.Parse("2006-01-02", start)
	e, _ := time.Parse("2006-01-02", end)
	d := int(e.Sub(s).Hours()/24) + 1
	if d < 1 {
		return 1
	}
	return d
}
