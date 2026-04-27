package tools

import (
	"context"
	"encoding/json"

	"github.com/rush-maestro/rush-maestro/internal/connector/googleads"
	"github.com/rush-maestro/rush-maestro/internal/domain"
	"github.com/rush-maestro/rush-maestro/internal/mcp"
)

// AdsClientFactory returns a configured Google Ads client for a given tenant.
// Returns an error if the tenant has no connected Google Ads integration.
type AdsClientFactory func(ctx context.Context, tenantID string) (*googleads.Client, *domain.Tenant, error)

// RegisterAdsTools registers all 10 Google Ads tools on the MCP server.
func RegisterAdsTools(s *mcp.Server, factory AdsClientFactory) {
	s.RegisterTool("get_live_metrics",
		"Get live campaign metrics from Google Ads API",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id": map[string]any{"type": "string"},
			},
			"required": []string{"tenant_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string `json:"tenant_id"`
			}
			json.Unmarshal(args, &p)
			client, _, err := factory(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			metrics, err := client.GetLiveMetrics(ctx)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(metrics)
		},
	)

	s.RegisterTool("get_campaign_criteria",
		"Get negative keywords, ad schedule, location/device criteria for a campaign",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id":   map[string]any{"type": "string"},
				"campaign_id": map[string]any{"type": "string"},
			},
			"required": []string{"tenant_id", "campaign_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID   string `json:"tenant_id"`
				CampaignID string `json:"campaign_id"`
			}
			json.Unmarshal(args, &p)
			client, _, err := factory(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			criteria, err := client.GetCriteria(ctx, p.CampaignID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(criteria)
		},
	)

	s.RegisterTool("get_search_terms",
		"Get search terms report for a campaign",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id":   map[string]any{"type": "string"},
				"campaign_id": map[string]any{"type": "string"},
				"days":        map[string]any{"type": "number", "default": 30, "minimum": 1, "maximum": 90},
			},
			"required": []string{"tenant_id", "campaign_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID   string `json:"tenant_id"`
				CampaignID string `json:"campaign_id"`
				Days       int    `json:"days"`
			}
			json.Unmarshal(args, &p)
			if p.Days <= 0 {
				p.Days = 30
			}
			client, _, err := factory(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			terms, err := client.GetSearchTerms(ctx, p.CampaignID, p.Days)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(terms)
		},
	)

	s.RegisterTool("get_ad_groups",
		"Get ad groups with metrics for a campaign",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id":   map[string]any{"type": "string"},
				"campaign_id": map[string]any{"type": "string"},
				"days":        map[string]any{"type": "number", "default": 7, "minimum": 1, "maximum": 30},
			},
			"required": []string{"tenant_id", "campaign_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID   string `json:"tenant_id"`
				CampaignID string `json:"campaign_id"`
				Days       int    `json:"days"`
			}
			json.Unmarshal(args, &p)
			if p.Days <= 0 {
				p.Days = 7
			}
			client, _, err := factory(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			groups, err := client.GetAdGroups(ctx, p.CampaignID, p.Days)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(groups)
		},
	)

	s.RegisterTool("add_negative_keywords",
		"Add negative keywords at campaign level",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id":   map[string]any{"type": "string"},
				"campaign_id": map[string]any{"type": "string"},
				"keywords":    map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"match_type":  map[string]any{"type": "string", "enum": []string{"broad", "phrase", "exact"}},
			},
			"required": []string{"tenant_id", "campaign_id", "keywords"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID   string   `json:"tenant_id"`
				CampaignID string   `json:"campaign_id"`
				Keywords   []string `json:"keywords"`
				MatchType  string   `json:"match_type"`
			}
			json.Unmarshal(args, &p)
			if p.MatchType == "" {
				p.MatchType = "broad"
			}
			client, _, err := factory(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			n, err := client.AddNegativeKeywords(ctx, p.CampaignID, p.Keywords, p.MatchType)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]int{"added": n})
		},
	)

	s.RegisterTool("update_campaign_budget",
		"Update daily budget for a campaign (in BRL)",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id":        map[string]any{"type": "string"},
				"campaign_id":      map[string]any{"type": "string"},
				"budget_id":        map[string]any{"type": "string"},
				"daily_budget_brl": map[string]any{"type": "number"},
			},
			"required": []string{"tenant_id", "campaign_id", "budget_id", "daily_budget_brl"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID       string  `json:"tenant_id"`
				CampaignID     string  `json:"campaign_id"`
				BudgetID       string  `json:"budget_id"`
				DailyBudgetBRL float64 `json:"daily_budget_brl"`
			}
			json.Unmarshal(args, &p)
			client, _, err := factory(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			if err := client.UpdateBudget(ctx, p.BudgetID, p.DailyBudgetBRL); err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]string{"updated": p.BudgetID})
		},
	)

	s.RegisterTool("set_weekday_schedule",
		"Add Mon–Fri ad schedule (ads don't serve Sat/Sun)",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id":   map[string]any{"type": "string"},
				"campaign_id": map[string]any{"type": "string"},
			},
			"required": []string{"tenant_id", "campaign_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID   string `json:"tenant_id"`
				CampaignID string `json:"campaign_id"`
			}
			json.Unmarshal(args, &p)
			client, _, err := factory(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			n, err := client.SetWeekdaySchedule(ctx, p.CampaignID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]int{"added": n})
		},
	)

	s.RegisterTool("add_ad_group_keywords",
		"Add keywords to an ad group",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id":              map[string]any{"type": "string"},
				"ad_group_resource_name": map[string]any{"type": "string"},
				"keywords":               map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"match_type":             map[string]any{"type": "string"},
			},
			"required": []string{"tenant_id", "ad_group_resource_name", "keywords"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID            string   `json:"tenant_id"`
				AdGroupResourceName string   `json:"ad_group_resource_name"`
				Keywords            []string `json:"keywords"`
				MatchType           string   `json:"match_type"`
			}
			json.Unmarshal(args, &p)
			if p.MatchType == "" {
				p.MatchType = "broad"
			}
			client, _, err := factory(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			kws := make([]googleads.AdGroupKeyword, len(p.Keywords))
			for i, k := range p.Keywords {
				kws[i] = googleads.AdGroupKeyword{Text: k, MatchType: p.MatchType}
			}
			n, err := client.AddAdGroupKeywords(ctx, p.AdGroupResourceName, kws)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]int{"added": n})
		},
	)

	s.RegisterTool("add_campaign_extensions",
		"Create and link callout and sitelink assets to a campaign",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id":   map[string]any{"type": "string"},
				"campaign_id": map[string]any{"type": "string"},
				"callouts":    map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"sitelinks": map[string]any{
					"type": "array",
					"items": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"text":        map[string]any{"type": "string"},
							"description": map[string]any{"type": "string"},
							"url":         map[string]any{"type": "string"},
						},
					},
				},
			},
			"required": []string{"tenant_id", "campaign_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID   string   `json:"tenant_id"`
				CampaignID string   `json:"campaign_id"`
				Callouts   []string `json:"callouts"`
				Sitelinks  []struct {
					Text        string `json:"text"`
					Description string `json:"description"`
					URL         string `json:"url"`
				} `json:"sitelinks"`
			}
			json.Unmarshal(args, &p)
			client, _, err := factory(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			sitelinks := make([]googleads.Sitelink, len(p.Sitelinks))
			for i, sl := range p.Sitelinks {
				sitelinks[i] = googleads.Sitelink{Text: sl.Text, Desc1: sl.Description, URL: sl.URL}
			}
			calloutCount, sitelinkCount, err := client.AddExtensions(ctx, p.CampaignID, p.Callouts, sitelinks)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]int{"callouts_added": calloutCount, "sitelinks_added": sitelinkCount})
		},
	)

	s.RegisterTool("set_campaign_status",
		"Pause or enable a campaign",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id":   map[string]any{"type": "string"},
				"campaign_id": map[string]any{"type": "string"},
				"status":      map[string]any{"type": "string", "enum": []string{"ENABLED", "PAUSED"}},
			},
			"required": []string{"tenant_id", "campaign_id", "status"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID   string `json:"tenant_id"`
				CampaignID string `json:"campaign_id"`
				Status     string `json:"status"`
			}
			json.Unmarshal(args, &p)
			client, _, err := factory(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			if err := client.SetCampaignStatus(ctx, p.CampaignID, p.Status); err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]string{"updated": p.CampaignID, "status": p.Status})
		},
	)
}
