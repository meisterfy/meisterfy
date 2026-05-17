# MCP Server — Maestro

Maestro exposes a **Model Context Protocol (MCP)** server so that external AI agents can read and write all content programmatically.

## Endpoint

```
http://localhost:8080/mcp
```

Transport: **Streamable HTTP**.
Accepts: `POST`, `GET`, `DELETE`

## Authentication

All requests require a bearer token:

```
Authorization: Bearer <your-mcp-key>
```

Keys are **tenant-scoped** — each key belongs to a specific tenant and grants access only to that tenant's data. Obtain a key from the UI at `/[tenant]/settings/mcp`. Keys can have one of three roles: `readonly`, `editor`, or `admin`.

## Configuration

Add to your `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "mkt-maestro-mcp": {
      "type": "http",
      "url": "http://localhost:8080/mcp",
      "headers": { "Authorization": "Bearer YOUR_MCP_KEY_HERE" }
    }
  }
}
```

The Go backend must be running (`make dev/backend`) for agents to reach the endpoint.

## Architecture

```
POST /mcp
  └─ backend/cmd/server/main.go
       └─ mcp.NewServer()
            ├─ tools/content.go    — content and campaign tools
            ├─ tools/ads.go        — Google Ads read/write tools
            ├─ tools/monitoring.go — metrics collection tools
            └─ tools/llm.go        — AI generation tools

middleware/mcp_auth.go
  └─ AuthenticateMCPKey — validates bearer token, injects tenantID + role into context
```

Tenant ID is inferred from the API key — no `tenant_id` parameter is needed in any tool call.

---

## Tools

### Content

| Tool | Params | Description |
|---|---|---|
| `get_current_tenant` | — | Full tenant record for the authenticated tenant |
| `update_tenant` | fields to patch | Update brand config |
| `list_posts` | `status?` | Posts filtered by status |
| `get_post` | `id` | Single post |
| `create_post` | `content` + optional | Create draft; ID auto-generated |
| `update_post_status` | `id`, `status` | Transition: draft → approved → scheduled → published |
| `delete_post` | `id` | Hard delete |
| `list_campaigns` | — | Local Google Ads campaign drafts |
| `get_campaign` | `slug` | Full campaign JSON |

### Google Ads — Read

| Tool | Params | Description |
|---|---|---|
| `get_live_metrics` | — | Live campaign metrics from Google Ads API |
| `get_campaign_criteria` | `campaign_id` | Negative keywords, schedule, location, device bids |
| `get_search_terms` | `campaign_id`, `days?` | Search terms report (default 30 days) |
| `get_ad_groups` | `campaign_id`, `days?` | Ad groups with metrics |

### Google Ads — Write

Requires `editor` or `admin` role.

| Tool | Params | Description |
|---|---|---|
| `add_negative_keywords` | `campaign_id`, `keywords[]`, `match_type?` | Add negative keywords at campaign level |
| `update_campaign_budget` | `budget_id`, `amount_brl` | Update daily budget (R$) |
| `set_weekday_schedule` | `campaign_id` | Add Mon–Fri schedule — ads stop serving Sat/Sun |
| `add_ad_group_keywords` | `ad_group_resource_name`, `keywords[]` | Add keywords to an ad group |
| `add_campaign_extensions` | `campaign_id`, `callouts[]`, `sitelinks[]` | Create and link callout + sitelink assets |
| `set_campaign_status` | `campaign_id`, `status` | `ENABLED` or `PAUSED` |

### Monitoring

| Tool | Params | Description |
|---|---|---|
| `get_metrics_history` | `campaign_id`, `days?` | Read stored daily metrics (no API call) |
| `get_monthly_summary` | `campaign_id`, `month` | Read consolidated monthly data |
| `collect_daily_metrics` | `date?` | Fetch from Google Ads API → store in DB. Defaults to yesterday. Requires `editor`+ role. |
| `consolidate_monthly` | `month?` | Aggregate daily → monthly summary. Defaults to previous month. Requires `editor`+ role. |

### LLM

| Tool | Params | Description |
|---|---|---|
| `generate_content` | `prompt`, `context?` | AI-assisted content generation |

---

## Typical agent workflows

**Collect and report on campaign performance:**
```
collect_daily_metrics()                      → store yesterday's data
get_metrics_history(campaign_id, days=7)     → read trend
create_post(content)                         → save summary
```

**Diagnose and fix a campaign issue:**
```
get_live_metrics()                           → check campaign health
get_search_terms(campaign_id)                → find irrelevant terms
add_negative_keywords(campaign_id, keywords)
get_live_metrics()                           → confirm improvement
```

---

## Adding a new tool

1. Open the relevant file in `backend/internal/mcp/tools/`
2. Call `server.AddTool(mcp.NewTool(name, ...), handler)` inside the `Register*` function
3. Use `mcp.WithString`, `mcp.WithBoolean`, etc. for input schema
4. Tenant ID and role are available via `mcp.TenantIDFromContext(ctx)` and `mcp.RoleFromContext(ctx)`
5. Return `mcp.NewToolResultText(json)` or error
6. Restart the backend — no other config needed

```go
server.AddTool(mcp.NewTool("my_tool",
    mcp.WithDescription("Does something useful"),
    mcp.WithString("campaign_id", mcp.Required()),
), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
    tenantID := mcp.TenantIDFromContext(ctx)
    campaignID := req.Params.Arguments["campaign_id"].(string)
    // ...
    return mcp.NewToolResultText(string(data)), nil
})
```
