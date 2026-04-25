# MCP Server — Marketing CMS

The Marketing CMS exposes a **Model Context Protocol (MCP)** server so that external AI agents (Claude Code, Gemini CLI, custom agents) can read and write content programmatically without touching the database directly.

## Endpoint

```
http://localhost:5173/mcp
```

Transport: **Streamable HTTP** (`WebStandardStreamableHTTPServerTransport`).  
Stateless — a new transport + server instance is created per request.

Accepts: `POST`, `GET`, `DELETE`

## Configuration

The root `.mcp.json` is auto-detected by Claude Code and Gemini CLI:

```json
{
  "mcpServers": {
    "marketing": {
      "type": "http",
      "url": "http://localhost:5173/mcp"
    }
  }
}
```

The dev server must be running (`bun dev`) before any agent call reaches the endpoint.

## Architecture

```
POST /mcp
  └─ src/routes/mcp/+server.ts          — SvelteKit request handler
       └─ createServer()                 — src/lib/server/mcp/server.ts
            ├─ registerContentTools()    — tools/content.ts
            ├─ registerAdsTools()        — tools/ads.ts
            └─ registerTenantResources() — resources/tenants.ts
```

Each call to `createServer()` registers tools and resources on a fresh `McpServer` instance from `@modelcontextprotocol/sdk`. The `McpServer` is then connected to the transport before handling the request.

---

## Tools

All tools return `{ content: [{ type: "text", text: "<JSON>" }] }`.  
On error, `isError: true` is also set.

### Tenant tools

| Tool | Required params | Optional params | What it does |
|---|---|---|---|
| `list_tenants` | — | — | Returns all tenants as JSON array |
| `get_tenant` | `id: string` | — | Returns full tenant record (brand config + persona) |
| `create_tenant` | `id`, `name` | `language`, `niche`, `location`, `tone`, `instructions`, `hashtags[]`, `google_ads_id` | Creates a new client in SQLite |
| `update_tenant` | `id` | same optional fields as create | Patches a tenant record |

### Post tools

| Tool | Required params | Optional params | What it does |
|---|---|---|---|
| `list_posts` | `tenant_id` | `status` (`draft`\|`approved`\|`scheduled`\|`published`) | Lists posts, optionally filtered |
| `get_post` | `id` | — | Returns single post including workflow JSON |
| `create_post` | `tenant_id`, `content` | `title`, `hashtags[]`, `media_type` | Creates a draft post; ID auto-generated from date + title slug |
| `update_post_status` | `id`, `status` | — | Transitions post status; sets `published_at` when publishing |
| `delete_post` | `id` | — | Hard-deletes a post |

### Report tools

| Tool | Required params | Optional params | What it does |
|---|---|---|---|
| `list_reports` | `tenant_id` | — | Returns report list (no content) |
| `get_report` | `tenant_id`, `slug` | — | Returns full report with markdown content |
| `create_report` | `tenant_id`, `slug`, `content` | `title` | Saves a report; type is inferred from slug |

**Slug naming conventions** (so the UI picks the right color/badge):

| Pattern | Type |
|---|---|
| contains `audit` | Audit (amber) |
| contains `search` or `campaign` | Search Campaign (blue) |
| contains `weekly` | Weekly (emerald) |
| ends with `YYYY-MM` or contains `monthly` | Monthly (violet) |
| contains `alert` | Alert (red) |
| anything else | Report (slate) |

### Campaign tools

| Tool | Required params | What it does |
|---|---|
| `list_campaigns` | `tenant_id` | Lists local campaign slugs for a client |
| `get_campaign` | `tenant_id`, `slug` | Returns full campaign JSON |

### Alert tool

| Tool | Required params | What it does |
|---|---|
| `check_alerts` | `tenant_id` | Returns open `WARN` / `CRITICAL` monitoring alerts |

### Ads tool

| Tool | Required params | What it does |
|---|---|
| `get_live_metrics` | `tenant_id` | Calls Google Ads API live and returns campaign metrics |

`get_live_metrics` requires:
- Tenant has a valid `google_ads_id` in SQLite
- `GOOGLE_ADS_*` env vars to be set (see `.env`)

---

## Resources

Resources follow the `tenant://` URI scheme and return static snapshots of data.

| URI | MIME | Description |
|---|---|---|
| `tenant://list` | `application/json` | All tenants |
| `tenant://{id}/brand` | `application/json` | Single tenant's brand config |
| `tenant://{id}/posts` | `application/json` | All posts for a tenant |
| `tenant://{id}/reports` | `application/json` | Report list (no content) |
| `tenant://{id}/reports/{slug}` | `text/markdown` | Full markdown content of one report |

Resources are read-only. Use tools to write data.

---

## Typical agent workflow

### Creating and publishing a social post

```
1. list_tenants          → pick tenant ID
2. create_post           → get draft ID back
3. update_post_status    → transition to "approved"
4. update_post_status    → transition to "published"  ← sets published_at
```

### Saving a report from analysis output

```
1. create_report(tenant_id, slug="google-ads-2026-04", content="# April\n...")
   → report is immediately visible in the UI at /{tenant}/reports/google-ads-2026-04
```

### Checking campaign health

```
1. check_alerts(tenant_id)     → any open WARN/CRITICAL?
2. get_live_metrics(tenant_id) → live spend, impressions, CPC from Google Ads
```

---

## Data layer

All tools call the same server-side TypeScript functions used by the SvelteKit loaders:

| Module | Functions |
|---|---|
| `src/lib/server/tenants.ts` | `listTenants`, `getTenant`, `createTenant`, `updateTenant` |
| `src/lib/server/posts.ts` | `listPosts`, `getPost`, `createPost`, `updatePostStatus`, `deletePost` |
| `src/lib/server/reports.ts` | `listReports`, `getReport`, `createReport`, `detectReportType` |
| `src/lib/server/campaigns.ts` | `listCampaigns`, `getCampaign` |
| `src/lib/server/googleAds.ts` | `getLiveCampaigns` |
| `src/lib/server/db/alerts.ts` | `getOpenAlerts` |

SQLite is the single source of truth. MCP writes are immediately reflected in the UI on next page load.

---

## Adding a new tool

1. Open the relevant file in `src/lib/server/mcp/tools/`
2. Call `server.registerTool(name, { description, inputSchema }, handler)` inside the `register*` function
3. The `inputSchema` uses **zod** — each key becomes a validated parameter
4. Return `ok(data)` or `err(message)`
5. Restart the dev server — no other configuration needed

```typescript
server.registerTool('my_tool', {
  description: 'Does something useful',
  inputSchema: {
    tenant_id: z.string(),
    limit: z.number().int().positive().default(10),
  }
}, ({ tenant_id, limit }) => {
  const rows = getSomething(tenant_id, limit)
  return ok(rows)
})
```
