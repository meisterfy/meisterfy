package googleads

import (
	"context"
	"fmt"
	"strings"
)

// SearchTermRow holds metrics for one actual search query that triggered an ad.
type SearchTermRow struct {
	Term        string  `json:"term"`
	Status      string  `json:"status"`      // "ADDED", "EXCLUDED", "NONE"
	Clicks      float64 `json:"clicks"`
	Impressions float64 `json:"impressions"`
	Cost        float64 `json:"cost"`        // BRL
	Conversions float64 `json:"conversions"`
	CPA         float64 `json:"cpa"`         // 0 if no conversions
	CTR         float64 `json:"ctr"`         // 0–100 percentage
}

// KeywordQSRow holds quality score data for one keyword.
type KeywordQSRow struct {
	KeywordText  string `json:"keywordText"`
	MatchType    string `json:"matchType"`   // "BROAD", "PHRASE", "EXACT"
	AdGroupName  string `json:"adGroupName"`
	QualityScore int    `json:"qualityScore"` // 1–10; 0 = insufficient data
	CreativeQS   string `json:"creativeQS"`   // "BELOW_AVERAGE", "AVERAGE", "ABOVE_AVERAGE", ""
	PostClickQS  string `json:"postClickQS"`
	PredictedCTR string `json:"predictedCTR"`
}

// KeywordPerfRow holds performance metrics for one keyword.
type KeywordPerfRow struct {
	KeywordText string  `json:"keywordText"`
	MatchType   string  `json:"matchType"`
	AdGroupName string  `json:"adGroupName"`
	Clicks      float64 `json:"clicks"`
	Impressions float64 `json:"impressions"`
	Cost        float64 `json:"cost"`        // BRL
	Conversions float64 `json:"conversions"`
	CPA         float64 `json:"cpa"`         // 0 if no conversions
	CTR         float64 `json:"ctr"`         // 0–100 percentage
}

// GetSearchTerms returns actual search queries that triggered ads for the campaign.
// Limited to top 100 rows by cost. If the API rejects date segmentation on
// search_term_view, retries without the date filter.
func (c *Client) GetSearchTerms(ctx context.Context, campaignID, startDate, endDate string) ([]SearchTermRow, error) {
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

	gaqlWithDate := fmt.Sprintf(`
		SELECT search_term_view.search_term, search_term_view.status,
		       metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions
		FROM search_term_view
		WHERE campaign.id = %s
		  AND segments.date BETWEEN '%s' AND '%s'
		ORDER BY metrics.cost_micros DESC
		LIMIT 100
	`, campaignID, startDate, endDate)

	rows, err := c.Query(ctx, gaqlWithDate)
	if err != nil {
		// Some account types don't support segments.date on search_term_view — retry without it.
		if strings.Contains(err.Error(), "search_term_view") && strings.Contains(err.Error(), "segments.date") {
			gaqlNoDate := fmt.Sprintf(`
				SELECT search_term_view.search_term, search_term_view.status,
				       metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions
				FROM search_term_view
				WHERE campaign.id = %s
				ORDER BY metrics.cost_micros DESC
				LIMIT 100
			`, campaignID)
			rows, err = c.Query(ctx, gaqlNoDate)
			if err != nil {
				return nil, fmt.Errorf("search terms query: %w", err)
			}
		} else {
			return nil, fmt.Errorf("search terms query: %w", err)
		}
	}

	result := make([]SearchTermRow, 0, len(rows))
	for _, row := range rows {
		cost := fromMicros(num(row, "metrics", "costMicros"))
		clicks := num(row, "metrics", "clicks")
		impressions := num(row, "metrics", "impressions")
		conversions := num(row, "metrics", "conversions")

		r := SearchTermRow{
			Term:        str(row, "searchTermView", "searchTerm"),
			Status:      str(row, "searchTermView", "status"),
			Clicks:      clicks,
			Impressions: impressions,
			Cost:        cost,
			Conversions: conversions,
		}
		if conversions > 0 {
			r.CPA = cost / conversions
		}
		if impressions > 0 {
			r.CTR = (clicks / impressions) * 100
		}
		result = append(result, r)
	}
	return result, nil
}

// GetKeywordQualityScores returns quality score data for all active keywords in the campaign.
// QS is not time-segmented so no date filter is applied.
func (c *Client) GetKeywordQualityScores(ctx context.Context, campaignID string) ([]KeywordQSRow, error) {
	if err := validateCampaignID(campaignID); err != nil {
		return nil, err
	}
	rows, err := c.Query(ctx, fmt.Sprintf(`
		SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
		       ad_group_criterion.quality_info.quality_score,
		       ad_group_criterion.quality_info.creative_quality_score,
		       ad_group_criterion.quality_info.post_click_quality_score,
		       ad_group_criterion.quality_info.search_predicted_ctr,
		       ad_group.name
		FROM ad_group_criterion
		WHERE campaign.id = %s
		  AND ad_group_criterion.type = 'KEYWORD'
		  AND ad_group_criterion.status != 'REMOVED'
	`, campaignID))
	if err != nil {
		return nil, fmt.Errorf("quality scores query: %w", err)
	}

	result := make([]KeywordQSRow, 0, len(rows))
	for _, row := range rows {
		result = append(result, KeywordQSRow{
			KeywordText:  str(row, "adGroupCriterion", "keyword", "text"),
			MatchType:    str(row, "adGroupCriterion", "keyword", "matchType"),
			AdGroupName:  str(row, "adGroup", "name"),
			QualityScore: int(num(row, "adGroupCriterion", "qualityInfo", "qualityScore")),
			CreativeQS:   str(row, "adGroupCriterion", "qualityInfo", "creativeQualityScore"),
			PostClickQS:  str(row, "adGroupCriterion", "qualityInfo", "postClickQualityScore"),
			PredictedCTR: str(row, "adGroupCriterion", "qualityInfo", "searchPredictedCtr"),
		})
	}
	return result, nil
}

// GetKeywordPerformance returns cost/conversion metrics for the top 50 keywords by spend.
// Uses keyword_view (the correct resource for date-ranged keyword metrics in Google Ads API).
func (c *Client) GetKeywordPerformance(ctx context.Context, campaignID, startDate, endDate string) ([]KeywordPerfRow, error) {
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
		SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
		       ad_group.name,
		       metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions
		FROM keyword_view
		WHERE campaign.id = %s
		  AND ad_group_criterion.status != 'REMOVED'
		  AND segments.date BETWEEN '%s' AND '%s'
		ORDER BY metrics.cost_micros DESC
		LIMIT 50
	`, campaignID, startDate, endDate))
	if err != nil {
		return nil, fmt.Errorf("keyword performance query: %w", err)
	}

	result := make([]KeywordPerfRow, 0, len(rows))
	for _, row := range rows {
		cost := fromMicros(num(row, "metrics", "costMicros"))
		clicks := num(row, "metrics", "clicks")
		impressions := num(row, "metrics", "impressions")
		conversions := num(row, "metrics", "conversions")

		r := KeywordPerfRow{
			KeywordText: str(row, "adGroupCriterion", "keyword", "text"),
			MatchType:   str(row, "adGroupCriterion", "keyword", "matchType"),
			AdGroupName: str(row, "adGroup", "name"),
			Clicks:      clicks,
			Impressions: impressions,
			Cost:        cost,
			Conversions: conversions,
		}
		if conversions > 0 {
			r.CPA = cost / conversions
		}
		if impressions > 0 {
			r.CTR = (clicks / impressions) * 100
		}
		result = append(result, r)
	}
	return result, nil
}
