# Marketing CMS

Local marketing management system for multiple clients. SvelteKit UI, SQLite storage, Google Ads integration, AI-assisted content generation via MCP and scripts.

## Stack

- **Runtime:** Bun
- **UI:** SvelteKit (Svelte 5 runes) + Tailwind v4
- **Database:** SQLite (`db/marketing.db`) via `bun:sqlite`
- **MCP server:** `@modelcontextprotocol/sdk` at `POST /mcp` (Streamable HTTP)
- **Google Ads:** `google-ads-api` v23
- **AI agents:** Claude Code sub-agents (`.claude/agents/`)

## Architecture

SQLite is the single source of truth for all content. The SvelteKit server routes read/write exclusively through the data layer in `src/lib/server/`.

```
SvelteKit UI
  └── src/routes/[tenant]/*        — pages + server loaders
  └── src/routes/mcp/+server.ts    — MCP endpoint (POST/GET/DELETE)
  └── src/routes/api/*             — REST endpoints

src/lib/server/
  tenants.ts · posts.ts · reports.ts · campaigns.ts   — SQLite CRUD
  googleAds.ts · googleAdsDetailed.ts                 — live Google Ads API
  storage.ts                                          — image reads from storage/images/
  mcp/server.ts                                       — createServer() factory
  mcp/tools/content.ts · ads.ts                       — 16 MCP tools
  mcp/resources/tenants.ts                            — 5 MCP resources

scripts/                  — debug tools and CLI operations (Bun, read .env automatically)
storage/images/[tenant]/  — post media files
db/marketing.db           — SQLite database (gitignored, auto-created)
.mcp.json                 — MCP config (auto-detected by Claude Code, Gemini CLI)
```

## Features

**Social** — post drafts, planner calendar, status workflow (draft → approved → published), media attach, Meta Graph API publish

**Google Ads** — local campaign drafts, deploy to Google Ads API (all PAUSED for review), live metrics, historical query

**Monitoring** — daily metrics collection, threshold alerts (CPA, conversions, impressions, budget pace), alerts inbox with resolve/ignore

**Reports** — markdown reports stored in SQLite, auto-typed by slug (audit, search, weekly, monthly), browser print-to-PDF

**MCP** — 16 tools + 5 resources exposing the full data layer to agents; served at `http://localhost:5173/mcp`

## MCP Tools

`list_tenants` · `get_tenant` · `create_tenant` · `update_tenant` · `list_posts` · `get_post` · `create_post` · `update_post_status` · `delete_post` · `list_reports` · `get_report` · `create_report` · `list_campaigns` · `get_campaign` · `check_alerts` · `get_live_metrics`

## Scripts

```bash
bun run dev                                                        # start UI + MCP server

bun run scripts/collect-daily-metrics.ts <tenant> [YYYY-MM-DD]    # Google Ads metrics → SQLite
bun run scripts/consolidate-monthly.ts <tenant> [YYYY-MM]         # monthly rollup
bun run scripts/deploy-google-ads.ts <campaign.json> <tenant_id>  # deploy to Google Ads API
bun run scripts/publish-social-post.ts <tenant_id> <post_id>      # publish via Meta API

bun run scripts/test-ads-connection.ts <customer-id>
bun run scripts/test-query.ts <customer-id> <campaign-id>
```

## Environment Variables

Create `.env` at the project root. Bun loads it automatically — never use `dotenv.config()`.

```
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
META_PAGE_ACCESS_TOKEN=
META_PAGE_ID=
META_INSTAGRAM_ACCOUNT_ID=
MEDIA_PUBLIC_BASE_URL=          # tunnel URL for Meta media uploads
FINAL_URL=                      # landing page URL for Google Ads deploy
```

## Crontab (monitoring)

```
3 7 * * * cd /path/to/marketing && bun run scripts/collect-daily-metrics.ts portico >> /tmp/ads.log 2>&1
```

---

## Roadmap

The next planned evolution is a full architecture upgrade — Go backend, PostgreSQL, public MCP endpoint, multi-connector (Canva, Meta, LinkedIn), multi-provider AI via UI, and R2/S3 for media and backups.

See [`.project/notes/architecture-v2-go-postgres-mcp.md`](.project/notes/architecture-v2-go-postgres-mcp.md) for the full design.
