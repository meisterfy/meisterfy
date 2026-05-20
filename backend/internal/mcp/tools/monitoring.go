package tools

import (
	"context"
	"encoding/json"
	"time"

	"github.com/mkt-maestro/mkt-maestro/internal/connector/googleads"
	"github.com/mkt-maestro/mkt-maestro/internal/mcp"
	"github.com/mkt-maestro/mkt-maestro/internal/repository"
)

// MonitoringRepos groups dependencies for monitoring tools.
type MonitoringRepos struct {
	Metrics    *repository.MetricsRepository
	Alerts     *repository.AlertRepository
	AgentRuns  *repository.AgentRunRepository
	AdsFactory AdsClientFactory
}

// RegisterMonitoringTools registers 4 monitoring tools: 2 read-only, 2 with Google Ads.
func RegisterMonitoringTools(s *mcp.Server, repos MonitoringRepos) {
	s.RegisterTool("get_metrics_history",
		"Get stored daily metrics for the authenticated tenant (last N days)",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"days": map[string]any{"type": "number", "default": 30, "minimum": 1, "maximum": 90},
			},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			tenantID, ok := mcp.TenantIDFromContext(ctx)
			if !ok {
				return mcp.ErrResult("tenant not authenticated")
			}
			var p struct {
				Days int `json:"days"`
			}
			if err := json.Unmarshal(args, &p); err != nil {
				return mcp.ErrResult("invalid arguments: " + err.Error())
			}
			if p.Days <= 0 {
				p.Days = 30
			}
			if p.Days > 90 {
				p.Days = 90
			}
			since := time.Now().AddDate(0, 0, -p.Days)
			rows, err := repos.Metrics.GetHistory(ctx, tenantID, since)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(rows)
		},
	)

	s.RegisterTool("get_monthly_summary",
		"Get consolidated monthly metrics for the authenticated tenant",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"months": map[string]any{"type": "number", "default": 6, "minimum": 1, "maximum": 24},
			},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			tenantID, ok := mcp.TenantIDFromContext(ctx)
			if !ok {
				return mcp.ErrResult("tenant not authenticated")
			}
			var p struct {
				Months int `json:"months"`
			}
			if err := json.Unmarshal(args, &p); err != nil {
				return mcp.ErrResult("invalid arguments: " + err.Error())
			}
			if p.Months <= 0 {
				p.Months = 6
			}
			rows, err := repos.Metrics.GetMonthlySummary(ctx, tenantID, p.Months)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(rows)
		},
	)

	s.RegisterTool("collect_daily_metrics",
		"Fetch metrics from Google Ads API and store in PostgreSQL with alert generation",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"date": map[string]any{"type": "string", "description": "YYYY-MM-DD, defaults to yesterday"},
			},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			tenantID, ok := mcp.TenantIDFromContext(ctx)
			if !ok {
				return mcp.ErrResult("tenant not authenticated")
			}
			role, _ := mcp.RoleFromContext(ctx)
			if role == "readonly" {
				return mcp.ErrResult("this key has read-only access")
			}
			var p struct {
				Date string `json:"date"`
			}
			if err := json.Unmarshal(args, &p); err != nil {
				return mcp.ErrResult("invalid arguments: " + err.Error())
			}
			if p.Date == "" {
				p.Date = time.Now().AddDate(0, 0, -1).Format("2006-01-02")
			}
			client, tenant, err := repos.AdsFactory(ctx, tenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			result, err := googleads.CollectDailyMetrics(
				ctx, client, tenant, p.Date,
				repos.Metrics, repos.Alerts, repos.AgentRuns,
			)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(result)
		},
	)

	s.RegisterTool("consolidate_monthly",
		"Aggregate daily metrics into monthly summary in PostgreSQL",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"month": map[string]any{"type": "string", "description": "YYYY-MM, defaults to last month"},
			},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			tenantID, ok := mcp.TenantIDFromContext(ctx)
			if !ok {
				return mcp.ErrResult("tenant not authenticated")
			}
			role, _ := mcp.RoleFromContext(ctx)
			if role == "readonly" {
				return mcp.ErrResult("this key has read-only access")
			}
			var p struct {
				Month string `json:"month"`
			}
			if err := json.Unmarshal(args, &p); err != nil {
				return mcp.ErrResult("invalid arguments: " + err.Error())
			}
			if p.Month == "" {
				p.Month = time.Now().AddDate(0, -1, 0).Format("2006-01")
			}
			result, err := googleads.ConsolidateMonthly(
				ctx, tenantID, p.Month, repos.Metrics, repos.AgentRuns,
			)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(result)
		},
	)
}
