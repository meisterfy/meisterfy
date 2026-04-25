# Marketing CMS — Context for Claude Code

Local marketing management system with multi-tenant support. Combines CMS with SQLite, AI-assisted content generation, Google Ads API integration, and an MCP server for agents.

## Stack

- **Runtime:** Bun
- **UI:** SvelteKit (Svelte 5 runes) + Tailwind v4 + `@tailwindcss/typography`
- **Database:** SQLite via `bun:sqlite` at `db/marketing.db`
- **MCP:** `@modelcontextprotocol/sdk` exposed at `POST /mcp` (Streamable HTTP)
- **Google Ads:** `google-ads-api` npm package (v23)
- **Markdown:** `marked` v18 (server-side, for reports)
- **Storage:** SQLite for content; images at `storage/images/[tenant]/`
- **Env:** variables in `.env` (never committed)

## Clients

Each client has a record in the `tenants` table in SQLite. Use the MCP tool `create_tenant` or the seed script to create new ones.

Each client's `google_ads_id` lives in SQLite (`tenants.google_ads_id`).
Real IDs, tracking tags and client URLs **never** go in committed files — they stay only in the database and `.env`.

## Directory Structure

```
src/
  routes/
    [tenant]/
      social/         — social post management (draft/approved/published)
      ads/google/     — Google Ads campaigns (local + live API)
      reports/        — report listing and viewing (MD rendered as prose)
      settings/       — client settings
    mcp/              — MCP endpoint (POST /mcp, GET /mcp, DELETE /mcp)
    api/              — internal REST endpoints

  lib/server/
    tenants.ts        — client CRUD (SQLite)
    posts.ts          — social post CRUD (SQLite)
    reports.ts        — report CRUD (SQLite)
    campaigns.ts      — Google Ads campaign CRUD (SQLite)
    googleAds.ts      — live campaign query via API
    googleAdsDetailed.ts — detailed metrics + history
    storage.ts        — image read/write in storage/images/
    mcp/
      server.ts       — createServer() factory (registers tools and resources)
      tools/
        content.ts    — tools: tenants, posts, reports, campaigns, alerts
        ads.ts        — tools: get_live_metrics
      resources/
        tenants.ts    — resources: tenant://list, tenant://{id}/brand|posts|reports
    db/
      index.ts        — getDb(), automatic migrations
      monitoring.ts   — daily and monthly metrics
      alerts.ts       — alert_events (WARN/CRITICAL)
      agent-runs.ts   — agent execution log

scripts/
  lib/
    ads.ts            — shared client factory (import from here, never write boilerplate)
  test-ads-connection.ts   — verify Google Ads API connection
  test-query.ts            — query campaign by ID
  test-query-ag.ts         — query ad groups by campaign
  test-query-history.ts    — 30-day history by campaign
  deploy-google-ads.ts     — deploy approved campaign to Google Ads
  publish-social-post.ts   — publish posts via Meta Graph API
  collect-daily-metrics.ts — collect daily Google Ads metrics → SQLite
  consolidate-monthly.ts   — consolidate monthly metrics → SQLite

storage/images/[tenant]/   — post images (served by /api/media/[tenant]/[filename])
db/marketing.db            — SQLite database (auto-generated, not committed)

.mcp.json                  — MCP config for Claude Code and Gemini CLI
.claude/
  agents/             — AI agent personas per client
  skills/             — custom Claude Code skills
```

## MCP Server

The MCP server exposes the data layer to external agents (Claude Code, Gemini CLI, etc.).

- **Endpoint:** `http://localhost:5173/mcp` (Streamable HTTP, stateless)
- **Config:** `.mcp.json` at root — auto-detected by Claude Code
- **Transport:** `WebStandardStreamableHTTPServerTransport` (new instance per request)

### Available Tools

| Tool | Description |
|---|---|
| `list_tenants` | List all clients |
| `get_tenant` | Brand config and persona for a client |
| `create_tenant` | Create new client |
| `update_tenant` | Edit brand config |
| `list_posts` | Posts for a client (optional filter by status) |
| `get_post` | Individual post with workflow |
| `create_post` | Create new draft |
| `update_post_status` | Status transition (draft → approved → published) |
| `delete_post` | Delete post |
| `list_reports` | Reports for a client |
| `get_report` | Full markdown content of a report |
| `create_report` | Save new report |
| `list_campaigns` | Local campaigns for a client |
| `get_campaign` | Full JSON of a campaign |
| `check_alerts` | Open monitoring alerts |
| `get_live_metrics` | Live metrics from Google Ads API |

### Available Resources

| URI | Description |
|---|---|
| `tenant://list` | List all tenants (JSON) |
| `tenant://{id}/brand` | Brand config for a tenant |
| `tenant://{id}/posts` | All posts for a tenant |
| `tenant://{id}/reports` | Report list for a tenant |
| `tenant://{id}/reports/{slug}` | Markdown content of a report |

## Scripts

All scripts run via `bun run <file>` from the project root. Bun injects `.env` automatically — never use `dotenv.config()`.

```bash
bun run scripts/test-ads-connection.ts <customer-id>
bun run scripts/test-query.ts <customer-id> <campaign-id>
bun run scripts/test-query-ag.ts <customer-id> <campaign-id>
bun run scripts/test-query-history.ts <customer-id> <campaign-id>
bun run scripts/deploy-google-ads.ts <path-to-campaign.json> <tenant_id>
bun run scripts/publish-social-post.ts <tenant_id> <post_id>
bun run scripts/collect-daily-metrics.ts <tenant> [YYYY-MM-DD]
bun run scripts/consolidate-monthly.ts <tenant> [YYYY-MM]
```

**Temporary analysis scripts** should be created at the root (not in `/tmp`) and deleted after use.

### scripts/lib/ads.ts — always use this

Every script that accesses Google Ads imports from here. Never instantiate `GoogleAdsApi` directly in scripts.

```typescript
import { ads, getCustomer, enums, micros, fromMicros } from './scripts/lib/ads.ts';

// Pre-configured client (defined in CLIENTS in ads.ts)
await ads['your-client'].query(`SELECT ...`);

// Ad-hoc client (any customer ID)
const c = getCustomer('123-456-7890');

// Currency helpers
micros(50)       // → 50_000_000
fromMicros(m)    // → value in BRL
```

To add a client to the pre-configured `ads`, edit `scripts/lib/ads.ts`:
```typescript
export const CLIENTS: Record<string, string> = {
  'your-client': 'CUSTOMER_ID_HERE', // comes from SQLite → tenants.google_ads_id
};
```

## UI — Types and Conventions

The UI uses strict typing — no `any`. Core types:

- `src/lib/server/tenants.ts` → `Tenant`, `AdsMonitoringConfig`
- `src/lib/server/posts.ts` → `Post`, `PostStatus`, `MediaType`, `PostWorkflow`
- `src/lib/server/reports.ts` → `Report`, `ReportType`
- `src/lib/server/campaigns.ts` → `Campaign`
- `src/lib/server/googleAds.ts` → `LiveCampaign`
- `src/lib/server/googleAdsDetailed.ts` → `DetailedCampaign`, `CampaignAdGroup`, `AdGroupMetrics`, `HistoryEntry`
- `src/lib/server/db.ts` → `PostWithMeta`, `PostPlatform`, `GoogleAdCampaignWithMeta` (UI types, shapes created by loaders)

## Reports

Reports are SQLite records (`reports` table) with markdown content. The UI detects the type from the slug:

| Slug pattern | Type | Color |
|---|---|---|
| `audit` | Audit | amber |
| `search` / `campaign` | Search Campaign | blue |
| `weekly` | Weekly | emerald |
| `monthly` / `YYYY-MM` at the end | Monthly | violet |
| `alert` | Alert | red |
| others | Report | slate |

Slug naming conventions:
- Audit: `google-ads-audit-YYYY-MM-DD`
- Monthly performance: `google-ads-YYYY-MM`
- Search campaign: `google-ads-search-YYYY-MM-DD`

The route `/[tenant]/reports/[slug]` renders MD as prose with a "Download PDF" button (via `window.print()`).
To create reports: MCP tool `create_report` or `createReport()` from `src/lib/server/reports.ts`.

## Operational Rules — Google Ads

**Never modify live campaigns autonomously.** Every change to an active campaign requires explicit confirmation before executing via API.

Required workflow:
1. Analysis and diagnosis → run freely
2. Change draft → generate, show, wait for approval
3. Live campaign change → describe the action, wait for confirmation, then execute
4. Confirm result via query after execution

## General Conventions

- SQLite is the source of truth for all content (posts, reports, campaigns, tenants)
- `clients/` is in `.gitignore` — contains only legacy post images
- `db/marketing.db` is in `.gitignore` — auto-generated by `getDb()`
- Commits follow Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Client IDs, campaign IDs and tracking tags never go in committed files
