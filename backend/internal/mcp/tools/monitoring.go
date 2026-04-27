package tools

import (
	"context"
	"encoding/json"
	"time"

	"github.com/rush-maestro/rush-maestro/internal/connector/googleads"
	"github.com/rush-maestro/rush-maestro/internal/mcp"
	"github.com/rush-maestro/rush-maestro/internal/repository"
)

// MonitoringRepos groups dependencies for monitoring tools.
type MonitoringRepos struct {
	Metrics   *repository.MetricsRepository
	Alerts    *repository.AlertRepository
	AgentRuns *repository.AgentRunRepository
	AdsFactory AdsClientFactory
}

// RegisterMonitoringTools registers 4 monitoring tools: 2 read-only, 2 with Google Ads.
func RegisterMonitoringTools(s *mcp.Server, repos MonitoringRepos) {
	s.RegisterTool("get_metrics_history",
		"Get stored daily metrics for a client (last N days)",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id": map[string]any{"type": "string"},
				"days":      map[string]any{"type": "number", "default": 30, "minimum": 1, "maximum": 90},
			},
			"required": []string{"tenant_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string `json:"tenant_id"`
				Days     int    `json:"days"`
			}
			json.Unmarshal(args, &p)
			if p.Days <= 0 {
				p.Days = 30
			}
			if p.Days > 90 {
				p.Days = 90
			}
			since := time.Now().AddDate(0, 0, -p.Days)
			rows, err := repos.Metrics.GetHistory(ctx, p.TenantID, since)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(rows)
		},
	)

	s.RegisterTool("get_monthly_summary",
		"Get consolidated monthly metrics for a client",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id": map[string]any{"type": "string"},
				"months":    map[string]any{"type": "number", "default": 6, "minimum": 1, "maximum": 24},
			},
			"required": []string{"tenant_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string `json:"tenant_id"`
				Months   int    `json:"months"`
			}
			json.Unmarshal(args, &p)
			if p.Months <= 0 {
				p.Months = 6
			}
			rows, err := repos.Metrics.GetMonthlySummary(ctx, p.TenantID, p.Months)
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
				"tenant_id": map[string]any{"type": "string"},
				"date":      map[string]any{"type": "string", "description": "YYYY-MM-DD, defaults to yesterday"},
			},
			"required": []string{"tenant_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string `json:"tenant_id"`
				Date     string `json:"date"`
			}
			json.Unmarshal(args, &p)
			if p.Date == "" {
				p.Date = time.Now().AddDate(0, 0, -1).Format("2006-01-02")
			}
			client, tenant, err := repos.AdsFactory(ctx, p.TenantID)
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
				"tenant_id": map[string]any{"type": "string"},
				"month":     map[string]any{"type": "string", "description": "YYYY-MM, defaults to last month"},
			},
			"required": []string{"tenant_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string `json:"tenant_id"`
				Month    string `json:"month"`
			}
			json.Unmarshal(args, &p)
			if p.Month == "" {
				p.Month = time.Now().AddDate(0, -1, 0).Format("2006-01")
			}
			result, err := googleads.ConsolidateMonthly(
				ctx, p.TenantID, p.Month, repos.Metrics, repos.AgentRuns,
			)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(result)
		},
	)
}
