# MCP Server — Rush Maestro

Rush Maestro exposes a **Model Context Protocol (MCP)** server so that external AI agents and future UI connectors can read and write all content programmatically.

## Endpoint

```
http://localhost:5173/mcp
```

Transport: **Streamable HTTP** (`WebStandardStreamableHTTPServerTransport`).
Stateless — a new transport + server instance per request.
Accepts: `POST`, `GET`, `DELETE`

## Configuration

`.mcp.json` at the project root is auto-detected by Claude Code and Gemini CLI:

```json
{
  "mcpServers": {
    "rush-maestro": {
      "type": "http",
      "url": "http://localhost:5173/mcp"
    }
  }
}
```

The dev server must be running (`bun dev`) for agents to reach the endpoint.

## Architecture

```
POST /mcp
  └─ src/routes/mcp/+server.ts
       └─ createServer()  — src/lib/server/mcp/server.ts
            ├─ registerContentTools()    — tools/content.ts
            ├─ registerAdsTools()        — tools/ads.ts
            ├─ registerMonitoringTools() — tools/monitoring.ts
            └─ registerTenantResources() — resources/tenants.ts
```

All tools return `{ content: [{ type: "text", text: "<JSON>" }] }`.
On error: `isError: true` is also set.

---

## Tools

### Content

| Tool | Params | Description |
|---|---|---|
| `list_tenants` | — | All clients as JSON array |
| `get_tenant` | `id` | Full tenant record (brand config) |
| `create_tenant` | `id`, `name` + optional fields | Create new client in SQLite |
| `update_tenant` | `id` + fields to patch | Update brand config |
| `list_posts` | `tenant_id`, `status?` | Posts filtered by status |
| `get_post` | `id` | Single post with workflow JSON |
| `create_post` | `tenant_id`, `content` + optional | Create draft; ID auto-generated |
| `update_post_status` | `id`, `status` | Transition: draft → approved → scheduled → published |
| `delete_post` | `id` | Hard delete |
| `list_reports` | `tenant_id` | Report list (no content) |
| `get_report` | `tenant_id`, `slug` | Full report with markdown content |
| `create_report` | `tenant_id`, `slug`, `content`, `title?` | Save report; type inferred from slug |
| `list_campaigns` | `tenant_id` | Local Google Ads campaign drafts |
| `get_campaign` | `tenant_id`, `slug` | Full campaign JSON |
| `check_alerts` | `tenant_id` | Open WARN/CRITICAL monitoring alerts |

### Google Ads — Read

| Tool | Params | Description |
|---|---|---|
| `get_live_metrics` | `tenant_id` | Live campaign metrics from Google Ads API |
| `get_campaign_criteria` | `tenant_id`, `campaign_id` | Negative keywords, schedule, location, device bids |
| `get_search_terms` | `tenant_id`, `campaign_id`, `days?` | Search terms report (default 30 days) |
| `get_ad_groups` | `tenant_id`, `campaign_id`, `days?` | Ad groups with metrics |

### Google Ads — Write

| Tool | Params | Description |
|---|---|---|
| `add_negative_keywords` | `tenant_id`, `campaign_id`, `keywords[]`, `match_type?` | Add negative keywords at campaign level |
| `update_campaign_budget` | `tenant_id`, `budget_id`, `amount_brl` | Update daily budget (R$) |
| `set_weekday_schedule` | `tenant_id`, `campaign_id` | Add Mon–Fri schedule — ads stop serving Sat/Sun |
| `add_ad_group_keywords` | `tenant_id`, `ad_group_resource_name`, `keywords[]` | Add keywords to an ad group |
| `add_campaign_extensions` | `tenant_id`, `campaign_id`, `callouts[]`, `sitelinks[]` | Create and link callout + sitelink assets |
| `set_campaign_status` | `tenant_id`, `campaign_id`, `status` | `ENABLED` or `PAUSED` |

### Monitoring

| Tool | Params | Description |
|---|---|---|
| `collect_daily_metrics` | `tenant_id`, `date?` | Fetch from Google Ads API → store in SQLite + generate alerts. Defaults to yesterday. |
| `consolidate_monthly` | `tenant_id`, `month?` | Aggregate daily → monthly summary. Defaults to previous month. |
| `get_metrics_history` | `tenant_id`, `campaign_id`, `days?` | Read stored daily metrics from SQLite (no API call) |
| `get_monthly_summary` | `tenant_id`, `campaign_id`, `month` | Read consolidated monthly data from SQLite |

---

## Resources

Read-only snapshots. Use tools to write.

| URI | MIME | Description |
|---|---|---|
| `tenant://list` | `application/json` | All tenants |
| `tenant://{id}/brand` | `application/json` | Tenant brand config |
| `tenant://{id}/posts` | `application/json` | All posts for a tenant |
| `tenant://{id}/reports` | `application/json` | Report list (no content) |
| `tenant://{id}/reports/{slug}` | `text/markdown` | Full markdown of one report |

---

## Report slug conventions

The UI assigns type and badge color based on slug pattern:

| Pattern | Type | Color |
|---|---|---|
| contains `audit` | Audit | amber |
| contains `search` or `campaign` | Search Campaign | blue |
| contains `weekly` | Weekly | emerald |
| ends with `YYYY-MM` or contains `monthly` | Monthly | violet |
| contains `alert` | Alert | red |
| anything else | Report | slate |

Naming examples: `google-ads-audit-2026-04-25` · `google-ads-2026-04` · `google-ads-search-2026-04-25` · `weekly-2026-04-21`

---

## Typical agent workflows

**Collect and report on campaign performance:**
```
collect_daily_metrics(tenant_id)          → store yesterday's data
get_metrics_history(tenant_id, campaign_id, days=7)  → read trend
create_report(tenant_id, slug, content)   → save to UI
```

**Diagnose and fix a campaign issue:**
```
check_alerts(tenant_id)                   → see open WARN/CRITICAL
get_search_terms(tenant_id, campaign_id)  → find irrelevant terms
add_negative_keywords(tenant_id, campaign_id, keywords)
get_live_metrics(tenant_id)               → confirm campaign is healthy
```

**Create and publish a social post:**
```
create_post(tenant_id, content, ...)      → draft ID returned
update_post_status(id, "approved")
update_post_status(id, "published")       → sets published_at
```

---

## Adding a new tool

1. Open the relevant file in `src/lib/server/mcp/tools/`
2. Call `server.registerTool(name, { description, inputSchema }, handler)` inside the `register*` function
3. `inputSchema` uses **zod** — each key becomes a validated parameter
4. Return `ok(data)` or `err(message)`
5. Restart dev server — no other config needed

```typescript
server.registerTool('my_tool', {
  description: 'Does something useful',
  inputSchema: {
    tenant_id: z.string(),
    limit:     z.number().int().positive().default(10),
  }
}, async ({ tenant_id, limit }) => {
  const rows = await getSomething(tenant_id, limit)
  return ok(rows)
})
```
