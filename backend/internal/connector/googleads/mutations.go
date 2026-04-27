package googleads

import (
	"context"
	"fmt"
)

var keywordMatchType = map[string]string{
	"broad":  "BROAD",
	"phrase": "PHRASE",
	"exact":  "EXACT",
}

// AdGroupKeyword is a keyword to add to an ad group.
type AdGroupKeyword struct {
	Text      string
	MatchType string // "broad", "phrase", "exact"
}

// Sitelink is a sitelink asset to create.
type Sitelink struct {
	Text  string
	Desc1 string
	Desc2 string
	URL   string
}

// AddNegativeKeywords adds negative keywords at campaign level.
// Returns the number of keywords added.
func (c *Client) AddNegativeKeywords(ctx context.Context, campaignID string, keywords []string, matchType string) (int, error) {
	mt := keywordMatchType[matchType]
	if mt == "" {
		mt = "BROAD"
	}

	ops := make([]map[string]any, len(keywords))
	for i, text := range keywords {
		ops[i] = map[string]any{
			"create": map[string]any{
				"campaign": c.rn("campaigns", campaignID),
				"negative": true,
				"keyword": map[string]any{
					"text":      text,
					"matchType": mt,
				},
			},
		}
	}

	resp, err := c.Mutate(ctx, fmt.Sprintf("/customers/%s/campaignCriteria:mutate", c.customerID), ops)
	if err != nil {
		return 0, err
	}
	return len(resp.Results), nil
}

// UpdateBudget updates the daily budget for a campaign budget resource.
func (c *Client) UpdateBudget(ctx context.Context, budgetID string, amountBRL float64) error {
	ops := []map[string]any{
		{
			"update": map[string]any{
				"resourceName": c.rn("campaignBudgets", budgetID),
				"amountMicros": micros(amountBRL),
			},
			"updateMask": "amount_micros",
		},
	}
	_, err := c.Mutate(ctx, fmt.Sprintf("/customers/%s/campaignBudgets:mutate", c.customerID), ops)
	return err
}

// SetWeekdaySchedule adds Mon–Fri full-day ad schedule criteria to a campaign.
// Returns the number of schedule entries added.
func (c *Client) SetWeekdaySchedule(ctx context.Context, campaignID string) (int, error) {
	days := []string{"MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"}
	ops := make([]map[string]any, len(days))
	for i, day := range days {
		ops[i] = map[string]any{
			"create": map[string]any{
				"campaign": c.rn("campaigns", campaignID),
				"adSchedule": map[string]any{
					"dayOfWeek":   day,
					"startHour":   0,
					"startMinute": "ZERO",
					"endHour":     24,
					"endMinute":   "ZERO",
				},
			},
		}
	}

	resp, err := c.Mutate(ctx, fmt.Sprintf("/customers/%s/campaignCriteria:mutate", c.customerID), ops)
	if err != nil {
		return 0, err
	}
	return len(resp.Results), nil
}

// AddAdGroupKeywords adds keywords to an ad group.
// Returns the number of keywords added.
func (c *Client) AddAdGroupKeywords(ctx context.Context, adGroupResourceName string, keywords []AdGroupKeyword) (int, error) {
	ops := make([]map[string]any, len(keywords))
	for i, kw := range keywords {
		mt := keywordMatchType[kw.MatchType]
		if mt == "" {
			mt = "BROAD"
		}
		ops[i] = map[string]any{
			"create": map[string]any{
				"adGroup": adGroupResourceName,
				"status":  "ENABLED",
				"keyword": map[string]any{
					"text":      kw.Text,
					"matchType": mt,
				},
			},
		}
	}

	resp, err := c.Mutate(ctx, fmt.Sprintf("/customers/%s/adGroupCriteria:mutate", c.customerID), ops)
	if err != nil {
		return 0, err
	}
	return len(resp.Results), nil
}

// AddExtensions creates callout and sitelink assets and links them to a campaign.
// Returns the number of callouts and sitelinks successfully linked.
func (c *Client) AddExtensions(ctx context.Context, campaignID string, callouts []string, sitelinks []Sitelink) (int, int, error) {
	// Phase 1: create all assets in one batch
	phase1Ops := make([]map[string]any, 0, len(callouts)+len(sitelinks))

	for _, text := range callouts {
		phase1Ops = append(phase1Ops, map[string]any{
			"assetOperation": map[string]any{
				"create": map[string]any{
					"calloutAsset": map[string]any{"calloutText": text},
				},
			},
		})
	}
	for _, sl := range sitelinks {
		phase1Ops = append(phase1Ops, map[string]any{
			"assetOperation": map[string]any{
				"create": map[string]any{
					"finalUrls": []string{sl.URL},
					"sitelinkAsset": map[string]any{
						"linkText":     sl.Text,
						"description1": sl.Desc1,
						"description2": sl.Desc2,
					},
				},
			},
		})
	}

	if len(phase1Ops) == 0 {
		return 0, 0, nil
	}

	phase1Resp, err := c.BatchMutate(ctx, phase1Ops)
	if err != nil {
		return 0, 0, fmt.Errorf("create assets: %w", err)
	}

	// Extract asset resource names in order (callouts first, then sitelinks)
	assetRNs := make([]string, 0, len(phase1Resp.MutateOperationResponses))
	for _, resp := range phase1Resp.MutateOperationResponses {
		if assetResult, ok := resp["assetResult"].(map[string]any); ok {
			if rn, ok := assetResult["resourceName"].(string); ok {
				assetRNs = append(assetRNs, rn)
			}
		}
	}

	if len(assetRNs) == 0 {
		return 0, 0, nil
	}

	// Phase 2: link assets to campaign
	phase2Ops := make([]map[string]any, 0, len(assetRNs))
	campaignRN := c.rn("campaigns", campaignID)

	for i, assetRN := range assetRNs {
		fieldType := "SITELINK"
		if i < len(callouts) {
			fieldType = "CALLOUT"
		}
		phase2Ops = append(phase2Ops, map[string]any{
			"campaignAssetOperation": map[string]any{
				"create": map[string]any{
					"campaign":  campaignRN,
					"asset":     assetRN,
					"fieldType": fieldType,
				},
			},
		})
	}

	_, err = c.BatchMutate(ctx, phase2Ops)
	if err != nil {
		return 0, 0, fmt.Errorf("link assets: %w", err)
	}

	calloutCount := min(len(callouts), len(assetRNs))
	sitelinkCount := len(assetRNs) - calloutCount
	return calloutCount, sitelinkCount, nil
}

// SetCampaignStatus pauses or enables a campaign.
func (c *Client) SetCampaignStatus(ctx context.Context, campaignID, status string) error {
	ops := []map[string]any{
		{
			"update": map[string]any{
				"resourceName": c.rn("campaigns", campaignID),
				"status":       status,
			},
			"updateMask": "status",
		},
	}
	_, err := c.Mutate(ctx, fmt.Sprintf("/customers/%s/campaigns:mutate", c.customerID), ops)
	return err
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
