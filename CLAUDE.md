# Rush Maestro — Context for Claude Code

Local marketing management system with multi-tenant support. Combines a CMS with AI-assisted content generation, Google Ads API integration, and an MCP server as the single communication layer for all agents.

## Stack

- **Backend:** Go (chi router, pgx/v5, goose migrations) — `backend/`
- **Frontend:** SvelteKit (Svelte 5 runes) + Tailwind v4 + `adapter-static` — `frontend/`
- **Database:** PostgreSQL via pgx at `rush_maestro`
- **MCP:** `@modelcontextprotocol/sdk` — Streamable HTTP at `POST /mcp` (Bun, temporary until T16)
- **Google Ads:** `google-ads-api` npm package (v23) — temporary until T17
- **Storage:** PostgreSQL for content; images at `storage/images/[tenant]/`
- **Credentials:** Google Ads OAuth stored in the `integrations` table (not `.env`)

## Agent Communication — MCP Only

**All agents interact with this system exclusively through MCP tools.** There are no agent `.md` files, no flat-file workflows, no direct script invocations from agents. The MCP server at `http://localhost:5173/mcp` is the only interface.

## Clients

Each client is a record in the `tenants` table. Create with `create_tenant` MCP tool.
Google Ads credentials live in the `integrations` table (provider `google_ads`).
Real IDs, tracking tags and URLs **never** go in committed files.

## Directory Structure

```
backend/                   — Go API (chi, pgx, goose)
  cmd/server/main.go       — entrypoint, router wiring, embeds frontend SPA
  cmd/migrate/main.go      — goose migration runner
  internal/
    api/                   — HTTP handlers (admin_tenants, admin_posts, …)
    domain/                — business types + logic (Tenant, Post, JWT, …)
    middleware/             — auth, CORS, logging
    repository/            — pgx repositories (one per domain entity)
    config/                — env-based config
  migrations/              — SQL migration files (goose)
  Makefile                 — backend-only targets (dev, migrate/*, sqlc, test)
  .env                     — local env (gitignored)

frontend/                  — SvelteKit SPA (adapter-static → backend/cmd/server/ui/dist/)
  src/
    routes/
      [tenant]/
        social/            — social post management (draft / approved / scheduled / published)
        ads/google/        — Google Ads campaigns (local draft + live API)
        reports/           — report listing and viewing (MD rendered as prose)
        alerts/            — monitoring alert inbox
        schedule/          — content planner calendar
      login/               — login page
      setup/               — first-run onboarding
      settings/            — integrations, tenant settings
    lib/
      api/                 — typed fetch modules (client.ts, tenants.ts, posts.ts, …)
      stores/auth.svelte.ts — in-memory token store (Svelte 5 runes)
      server/              — legacy Bun server code (being removed task by task)
        mcp/               — MCP server (kept until T16)
        googleAds*.ts      — Google Ads client (kept until T17)
  scripts/                 — legacy Bun scripts for cron/deployment (being replaced by Go)
    lib/ads.ts             — script-side Google Ads client

Makefile                   — root coordinator (dev/backend, dev/frontend, build, migrate/*)
storage/images/[tenant]/   — post images (served at /api/media/[tenant]/[filename])
.mcp.json                  — MCP config (auto-detected by Claude Code and Gemini CLI)
docker-compose.yml         — postgres + minio
docker-compose.dev.yml     — backend service with air hot-reload
```

## Development

```bash
make dev/backend    # Go API with air on :8181
make dev/frontend   # SvelteKit dev server on :5173 (proxies /admin /auth /setup /health /mcp → :8181)
make build          # bun run build → backend/cmd/server/ui/dist/ + go build
make migrate/up     # run pending goose migrations
```

First-time setup: `GET /health` returns `setup_required: true` → visit `http://localhost:5173/setup`.

## Backend — Go API

### Handler files

```
backend/internal/api/
  admin_tenants.go    — GET/POST /admin/tenants, CRUD /admin/tenants/{id}
  admin_posts.go      — CRUD + status transitions /admin/tenants/{id}/posts
  admin_reports.go    — CRUD /admin/tenants/{id}/reports
  admin_campaigns.go  — CRUD + deploy /admin/tenants/{id}/campaigns
  admin_alerts.go     — list/count/history/resolve/ignore /admin/tenants/{id}/alerts
  admin_schedule.go   — GET /admin/tenants/{id}/schedule (agent-run history)
  admin_users.go      — user management
  admin_roles.go      — RBAC roles and permissions
  auth.go             — login, refresh, logout, me
  setup.go            — first-run admin creation
  health.go           — /health
```

All `/admin/*` routes require a valid JWT (`AuthenticateAdmin` middleware).
Tenant-scoped endpoints validate that the requesting user has access via `UserClaims`.

### Repository pattern

One repository per entity in `backend/internal/repository/`. Each wraps sqlc-generated queries from `backend/internal/repository/db/`. Raw pgx queries only for tables without sqlc coverage (e.g., `agent_runs`).

## Frontend — SvelteKit SPA

### API client layer (`frontend/src/lib/api/`)

| File | Exports |
|---|---|
| `client.ts` | `apiFetch`, `setToken`, `clearToken` — base fetch with auto-refresh |
| `tenants.ts` | `getTenants`, `getTenant`, `createTenant`, `updateTenant`, `deleteTenant` |
| `posts.ts` | `getPosts`, `getPost`, `createPost`, `updatePost`, `updatePostStatus`, `deletePost` |
| `reports.ts` | `getReports`, `getReport`, `createReport`, `deleteReport` |
| `campaigns.ts` | `getCampaigns`, `getCampaign`, `createCampaign`, `deleteCampaign`, `deployCampaign` |
| `alerts.ts` | `getAlerts`, `getAlertCount`, `getAlertHistory`, `resolveAlert`, `ignoreAlert` |
| `schedule.ts` | `getSchedule` |
| `integrations.ts` | `getIntegrations`, `createIntegration`, `updateIntegration`, `deleteIntegration` |

### Auth flow

- Access token stored in memory (`frontend/src/lib/stores/auth.svelte.ts`)
- Refresh token lives in HttpOnly cookie managed by Go API
- `hooks.client.ts` calls `auth.restoreSession()` on every page load
- Unauthenticated API calls throw `{ status: 401 }` — `+page.ts` loads redirect to `/login`

## MCP Tools Reference

### Content

| Tool | Description |
|---|---|
| `list_tenants` | List all clients |
| `get_tenant` | Brand config for a client |
| `create_tenant` | Create new client |
| `update_tenant` | Edit brand config |
| `list_posts` | Posts for a client (filter by status) |
| `get_post` | Individual post with workflow |
| `create_post` | Create new draft |
| `update_post_status` | Status transition (draft → approved → scheduled → published) |
| `delete_post` | Delete post |
| `list_reports` | Reports for a client |
| `get_report` | Full markdown content of a report |
| `create_report` | Save new report |
| `list_campaigns` | Local campaign drafts for a client |
| `get_campaign` | Full JSON of a local campaign |
| `check_alerts` | Open monitoring alerts (WARN/CRITICAL) |

### Google Ads — Read

| Tool | Description |
|---|---|
| `get_live_metrics` | Live campaign metrics from Google Ads API |
| `get_campaign_criteria` | Negative keywords, ad schedule, location/device criteria |
| `get_search_terms` | Search terms report (last N days) |
| `get_ad_groups` | Ad groups with metrics |

### Google Ads — Write

| Tool | Description |
|---|---|
| `add_negative_keywords` | Add negative keywords at campaign level |
| `update_campaign_budget` | Update daily budget (in BRL) |
| `set_weekday_schedule` | Add Mon–Fri schedule — ads don't serve Sat/Sun |
| `add_ad_group_keywords` | Add keywords to an ad group |
| `add_campaign_extensions` | Create and link callout + sitelink assets |
| `set_campaign_status` | Pause or enable a campaign |

### Monitoring

| Tool | Description |
|---|---|
| `collect_daily_metrics` | Fetch metrics from Google Ads API → store in PostgreSQL + generate alerts |
| `consolidate_monthly` | Aggregate daily → monthly summary in PostgreSQL |
| `get_metrics_history` | Read stored daily metrics (last N days) |
| `get_monthly_summary` | Read consolidated monthly data |

## Legacy Scripts (`frontend/scripts/`)

Scripts are Bun/TypeScript utilities being replaced by Go handlers task by task. Agents do not call them directly.

```bash
cd frontend
bun run scripts/collect-daily-metrics.ts <tenant> [YYYY-MM-DD]
bun run scripts/consolidate-monthly.ts <tenant> [YYYY-MM]
bun run scripts/deploy-google-ads.ts <path-to-campaign.json> <tenant_id>
bun run scripts/publish-social-post.ts <tenant_id> <post_id>
bun run scripts/test-ads-connection.ts <customer-id>
```

### scripts/lib/ads.ts

Every script that accesses Google Ads imports from here. Never instantiate `GoogleAdsApi` directly in scripts.

```typescript
import { getCustomer, enums, micros, fromMicros } from './scripts/lib/ads.ts';
const c = getCustomer('123-456-7890');
```

## Reports

Reports are PostgreSQL records with markdown content. Slug naming drives the UI badge color:

| Slug pattern | Type | Color |
|---|---|---|
| `audit` | Audit | amber |
| `search` / `campaign` | Search Campaign | blue |
| `weekly` | Weekly | emerald |
| `monthly` / ends with `YYYY-MM` | Monthly | violet |
| `alert` | Alert | red |
| others | Report | slate |

Naming conventions: `google-ads-audit-YYYY-MM-DD`, `google-ads-YYYY-MM`, `google-ads-search-YYYY-MM-DD`.

## Operational Rules — Google Ads

**Never modify live campaigns autonomously.** Required workflow:

1. Analysis → run freely via read tools
2. Draft changes → generate, show to user, wait for approval
3. Execute mutation → describe the action, wait for explicit confirmation, then call write tool
4. Verify → query after execution to confirm the change took effect

## General Conventions

- PostgreSQL is the source of truth for all content
- Commits follow Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Client IDs, campaign IDs and tracking tags never go in committed files
- Svelte components use `untrack()` for `$state` initialized from `$props` + `$effect` for sync
- Rune-based stores must use `.svelte.ts` extension (not `.ts`)

## Language Rules

**All files in `.project/` must be written in English** — this includes task files, ADRs, architecture notes, and the roadmap README. This ensures any agent (regardless of session language) can read and act on them without ambiguity.

- `.project/tasks/*.md` → English
- `.project/adrs/*.md` → English
- `.project/notes/*.md` → English
- Code comments → English
- Commit messages → English
- Conversation with the user → Portuguese (the user communicates in pt-BR)
