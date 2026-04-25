# Rush Maestro

Local marketing management system with multi-tenant support. Combines a CMS, Google Ads integration, AI-assisted content generation, and an MCP server as the single interface for all AI agents.

## Stack

- **Runtime:** Bun
- **UI:** SvelteKit (Svelte 5 runes) + Tailwind v4
- **Database:** SQLite at `db/marketing.db` via `bun:sqlite`
- **MCP:** `@modelcontextprotocol/sdk` — Streamable HTTP at `POST /mcp`
- **Google Ads:** `google-ads-api` v23
- **Credentials:** Google Ads OAuth stored in the `integrations` table

## Architecture

SQLite is the single source of truth. The MCP server is the single interface for all AI agents — no flat-file workflows, no agent `.md` personas. The same 29 MCP tools serve both CLI agents today and a future UI with LLM API connectors.

```
SvelteKit UI
  └── src/routes/[tenant]/*      — pages + server loaders
  └── src/routes/mcp/+server.ts  — MCP endpoint (POST/GET/DELETE)
  └── src/routes/api/*           — internal REST

src/lib/server/
  tenants · posts · reports · campaigns   — SQLite CRUD
  googleAds · googleAdsDetailed           — live Google Ads API
  googleAdsClient.ts                      — shared customer factory
  mcp/server.ts                           — createServer() factory
  mcp/tools/content · ads · monitoring    — 29 MCP tools
  mcp/resources/tenants                   — tenant:// resources
  db/monitoring · alerts · agent-runs     — telemetry

scripts/        — cron wrappers and deployment utilities (system-level only)
storage/images/ — post media (served at /api/media/[tenant]/[filename])
.mcp.json       — MCP config (auto-detected by Claude Code and Gemini CLI)
```

## Features

**Social** — drafts, content planner calendar, status workflow (draft → approved → scheduled → published), media upload, Meta Graph API publishing

**Google Ads** — local campaign drafts, deploy to Google Ads API, live metrics, negative keywords, budget management, ad scheduling, extensions

**Monitoring** — daily metrics collection, threshold alerts (CPA, conversions, impression share, budget pacing), WARN/CRITICAL inbox with resolve/ignore

**Reports** — markdown reports in SQLite, auto-typed by slug (audit, search, weekly, monthly), browser print-to-PDF

**MCP** — 29 tools + 5 resources over Streamable HTTP at `http://localhost:5173/mcp`

## MCP Tools

See [`docs/mcp.md`](docs/mcp.md) for full reference.

**Content:** `list_tenants` · `get_tenant` · `create_tenant` · `update_tenant` · `list_posts` · `get_post` · `create_post` · `update_post_status` · `delete_post` · `list_reports` · `get_report` · `create_report` · `list_campaigns` · `get_campaign` · `check_alerts`

**Google Ads — Read:** `get_live_metrics` · `get_campaign_criteria` · `get_search_terms` · `get_ad_groups`

**Google Ads — Write:** `add_negative_keywords` · `update_campaign_budget` · `set_weekday_schedule` · `add_ad_group_keywords` · `add_campaign_extensions` · `set_campaign_status`

**Monitoring:** `collect_daily_metrics` · `consolidate_monthly` · `get_metrics_history` · `get_monthly_summary`

## Quick Start

```bash
bun install
bun dev          # starts UI + MCP server at http://localhost:5173
```

Google Ads credentials are configured via **Settings → Integrations** in the UI (OAuth flow). No manual `.env` needed for Google Ads.

## Scripts

System-level only — for cron jobs, deployment, and diagnostics. Agents use MCP tools instead.

```bash
bun run scripts/collect-daily-metrics.ts <tenant> [YYYY-MM-DD]
bun run scripts/consolidate-monthly.ts <tenant> [YYYY-MM]
bun run scripts/deploy-google-ads.ts <campaign.json> <tenant_id>
bun run scripts/publish-social-post.ts <tenant_id> <post_id>
bun run scripts/test-ads-connection.ts <customer-id>
```

## Environment Variables

Only a subset of functionality requires `.env`. Bun loads it automatically.

```
META_PAGE_ACCESS_TOKEN=
META_PAGE_ID=
META_INSTAGRAM_ACCOUNT_ID=
MEDIA_PUBLIC_BASE_URL=     # tunnel URL for Meta media uploads
FINAL_URL=                 # landing page for Google Ads deploy script
```

## Crontab

```
3 7 * * * cd /path/to/rush-maestro && bun run scripts/collect-daily-metrics.ts <tenant> >> /tmp/ads.log 2>&1
```

---

Architecture notes and future plans: [`.project/notes/`](.project/notes/)
