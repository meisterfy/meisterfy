# Mkt Maestro — Complete Project Analysis

**Date:** 2026-05-17  
**Analyst:** Claude Code (claude-sonnet-4-6)  
**Branch:** claude/project-analysis-aEkST  
**Status:** Pre-alpha

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Backend — Go](#3-backend--go)
4. [Frontend — SvelteKit](#4-frontend--sveltekit)
5. [Database Schema](#5-database-schema)
6. [Integrations & Connectors](#6-integrations--connectors)
7. [MCP Server](#7-mcp-server)
8. [Scheduler & Automation](#8-scheduler--automation)
9. [Security Analysis](#9-security-analysis)
10. [Testing Suite](#10-testing-suite)
11. [DevOps & CI/CD](#11-devops--cicd)
12. [Open Source Strategy](#12-open-source-strategy)
13. [Strengths](#13-strengths)
14. [Risks & Gaps](#14-risks--gaps)
15. [Roadmap Priorities](#15-roadmap-priorities)

---

## 1. Project Overview

**Mkt Maestro** is a full-stack SaaS marketing management platform with three core pillars:

1. **Social Content Planner** — Calendar-based post scheduling across Meta (Facebook/Instagram), with AI-assisted content generation via multiple LLM providers.
2. **Google Ads Manager** — Live campaign monitoring, historical analytics (impressions, clicks, CPC, CPA, ROAS, conversion data, keywords, devices, search terms, quality scores), and automated campaign editing with configurable variance limits.
3. **AI Automation Layer** — Multi-LLM integration (Claude, OpenAI, Gemini, Groq, Kimi), background scheduler for daily reports and campaign adjustments, and an MCP server that exposes the full platform to AI agents.

**Strategic Positioning:** The platform is designed to be "pilotable by AI agents" via its MCP server — not just a dashboard where humans click, but an infrastructure layer where agents can execute the full marketing cycle autonomously with human approval gates.

**Target:** Marketing agencies. Open source + self-hosted model with a cloud offering for non-technical teams.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  SvelteKit SPA                       │
│         (Svelte 5 runes, Tailwind v4, Bun)           │
│  Embedded in Go binary for production (go:embed)    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼──────────────────────────────┐
│                   Go API Server                      │
│              (chi router, pgx/v5)                   │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Handlers │  │Middleware│  │   Scheduler       │  │
│  └────┬─────┘  └──────────┘  └──────────────────┘  │
│       │                                             │
│  ┌────▼──────────────────────────────────────────┐  │
│  │              Repositories (sqlc)              │  │
│  └────────────────────────┬──────────────────────┘  │
│                           │                         │
│  ┌────────────────────────▼──────────────────────┐  │
│  │           PostgreSQL (pgx/v5, goose)          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │         MCP Server (/mcp endpoint)            │  │
│  │   Tools: content, ads, llm, monitoring        │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │         Connectors (14 providers)             │  │
│  │  Google Ads, Meta, Claude, OpenAI, Gemini,    │  │
│  │  Groq, Kimi, Brevo, Resend, S3, R2, Sentry   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Key architectural decisions:**
- Frontend is embedded in the Go binary via `//go:embed` — single binary deployment
- In dev mode, backend proxies to Vite dev server
- All external credentials encrypted at rest (AES-256-GCM)
- MCP server coexists with REST API on the same process

---

## 3. Backend — Go

### Entry Point

`backend/cmd/server/main.go`:
- Loads config from environment
- Initializes PostgreSQL connection pool (pgxpool)
- Registers 12 repositories via dependency injection
- Sets up chi router with full middleware stack
- Starts background scheduler
- Embeds SvelteKit build for production

### Router Structure

```
GET  /health                         → Health check + setup detection
POST /setup                          → First-run admin creation
POST /auth/login                     → JWT login
POST /auth/refresh                   → Token refresh (cookie)
POST /auth/logout                    → Clear cookie
GET  /auth/me                        → Current user + tenants
GET  /auth/google-ads/start          → OAuth redirect
GET  /auth/google-ads/callback       → OAuth callback
GET  /auth/meta/start                → Meta OAuth redirect
GET  /auth/meta/callback             → Meta OAuth callback
/admin/*                             → All REST routes (JWT required)
GET  /api/media/{tenant}/{id}        → Media serving
POST /api/media/{tenant}             → Media upload
DELETE /api/media/{tenant}/{id}      → Media delete
POST /ai/generate                    → SSE stream for AI generation
/mcp                                 → MCP server (HTTP streamable)
/*                                   → SPA fallback (200.html)
```

### Middleware Stack

| Middleware | Purpose |
|---|---|
| `RealIP` | Extract real client IP |
| `SentryHubMiddleware` | Attach Sentry hub to context |
| `SentryRecovery` | Capture panics to Sentry |
| `Recoverer` | Built-in chi panic recovery |
| `RequestLogger` | Structured logging (slog) |
| `NPlus1Detector` | Detect N+1 query patterns (dev only) |
| `SecurityHeaders` | XSS, CSRF, Clickjacking, HSTS, CSP |
| `RequestSize(4MB)` | Global body size limit |
| `AuthenticateAdmin` | Validate JWT, set claims in context |
| `RequirePermission(name)` | Check claims for specific permission |
| `RequireTenantMatch` | Enforce tenant scope in URL |
| `RateLimitLogin` | 3 req/min per IP on login |
| `AdminCORS` | CORS whitelist for admin panel |

### Handlers

| Handler | Endpoints |
|---|---|
| `auth.go` | Login, refresh, logout, /me, change password |
| `admin_users.go` | CRUD users, assign roles |
| `admin_roles.go` | CRUD roles + permissions |
| `admin_tenants.go` | CRUD tenants |
| `admin_posts.go` | CRUD posts, list by status, update status |
| `admin_campaigns.go` | CRUD campaigns, list live, deploy |
| `admin_google_ads.go` | Live data: impressions, clicks, devices, hourly, keywords, quality scores, search terms, sync history |
| `ai_generate.go` | SSE streaming, list available LLM providers |
| `admin_integrations.go` | CRUD integrations, test connection, assign tenants |
| `oauth_google_ads.go` | Google Ads OAuth start + callback |
| `oauth_meta.go` | Meta OAuth start + callback |
| `meta_publish.go` | List Meta accounts, publish posts |
| `media.go` | Serve, upload, delete media |
| `admin_audit_log.go` | List audit log entries |

### Domain Models

```go
type Tenant struct {
    ID, Name, Language, Niche, Location
    PrimaryPersona, Tone, Instructions
    Hashtags        []string
    AdsMonitoring   *AdsMonitoringConfig  // JSONB
    ReportPrompts   *ReportPrompts        // JSONB
}

type AdsMonitoringConfig struct {
    TargetCPABRL, NoConversionAlertDays, MaxCPAMultiplier
    MinDailyImpressions, BudgetUnderpaceThreshold
    SyncEnabled, AIReportDaily, AIReportWeekly, AIReportMonthly
    AdjustmentsEnabled
    MaxIncreasePct, MaxDecreasePct   // variance safety rails
}

type Post struct {
    ID, TenantID
    Status        string  // draft | approved | scheduled | published
    Title, Content
    Hashtags      []string
    MediaType, MediaPath
    Platforms     []string
    ScheduledDate, ScheduledTime
    PublishedAt   *time.Time
}

type Integration struct {
    ID, Name, Provider  // google_ads | meta | openai | anthropic | etc.
    Group               // ads | social_media | llm | email | monitoring
    Status              // pending | connected | error
    OAuthClientID, OAuthClientSecret (encrypted)
    DeveloperToken (encrypted)
    RefreshToken (encrypted)
    TenantIDs []string
    Config    map[string]any  // JSONB
}

type Role struct {
    ID, Name
    TenantID    *string  // nil = global role
    Permissions []string
}
```

### Repository Layer

All repositories use **sqlc** — SQL queries compiled to type-safe Go code. Zero ORM overhead, zero reflection, predictable query plans.

| Repository | Key Methods |
|---|---|
| `UserRepository` | GetByEmail, GetByID, Create, Update, Delete, List |
| `TenantRepository` | Create, Update, GetByID, Delete, List |
| `PostRepository` | CRUD + ListByStatus + UpdateStatus |
| `CampaignRepository` | CRUD + GetBySlug |
| `IntegrationRepository` | CRUD + encrypt/decrypt credential fields |
| `ConnectorResourceRepository` | Upsert, ListByTenant, ListByIntegration |
| `RBACRepository` | Roles, permissions, user-tenant-role assignments |
| `AlertRepository` | Create, Resolve, Ignore, ListOpen |
| `MetricsRepository` | Store daily snapshots, query by range |
| `AgentRunRepository` | Log job runs with status + result JSONB |
| `AuditLogRepository` | Append-only, before/after JSONB per action |
| `CampaignReportRepository` | Store AI-generated reports per campaign |

---

## 4. Frontend — SvelteKit

### Stack

- **SvelteKit 5** with **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$props`, `$bindable`)
- **Bun** runtime (not Node)
- **Tailwind v4** with typography + forms plugins
- **bits-ui + shadcn/svelte** for component primitives
- **Paraglide JS** for i18n (English + Portuguese BR)
- **adapter-static** for static builds (embedded in Go binary)

### Route Structure

```
/login                           → Auth
/setup                           → First-run wizard
/                                → Tenant list (home)
/tenants/new                     → Onboarding
/profile                         → User profile + locale
/settings/integrations           → Global integrations (LLMs, storage, email)
/[tenant]/social                 → Post planner (calendar)
/[tenant]/social/[post_id]       → Edit post
/[tenant]/social/drafts          → Draft manager + AI generation
/[tenant]/ads/google/live        → Live campaigns list
/[tenant]/ads/google/live/[id]   → Campaign detail (8 tabs)
/[tenant]/settings/general       → Brand config
/[tenant]/settings/google-ads    → Ads monitoring thresholds
/[tenant]/settings/users         → User management
/[tenant]/settings/roles         → Custom roles + permissions
/[tenant]/settings/audit         → Audit log viewer
```

### Campaign Detail Tabs

The campaign detail page (`/[tenant]/ads/google/live/[id]`) has 8 tabs:
1. Overview (impressions, clicks, CPC, CPA, ROAS)
2. Hourly performance
3. Device breakdown
4. Keywords
5. Search Terms
6. Quality Scores
7. Impression Share
8. AI Reports + Chat

### Rune Stores (`.svelte.ts`)

| Store | State |
|---|---|
| `auth.svelte.ts` | User auth state, JWT token, login/logout |
| `theme.svelte.ts` | Dark mode toggle (localStorage) |
| `locale.svelte.ts` | i18n language (localStorage) |
| `campaign-chat.svelte.ts` | Chat message history + scroll state |

### API Client Pattern

```typescript
// src/lib/api/client.ts — base wrapper with auto token refresh
export const apiFetchData = <T>(path: string, options?: RequestInit): Promise<T>

// Each module (posts.ts, campaigns.ts, etc.)
export const getPosts = (tenantId: string, status?: string) =>
  apiFetchData<Post[]>(`/admin/tenants/${tenantId}/posts`)

export const createPost = (tenantId: string, body: Partial<Post>) =>
  apiFetchData<Post>(`/admin/tenants/${tenantId}/posts`, {
    method: 'POST',
    body: JSON.stringify(body)
  })
```

---

## 5. Database Schema

### 21 Migrations (Goose)

| Migration | Purpose |
|---|---|
| `000001` | Enable pgcrypto, uuid-ossp extensions |
| `000002` | `tenants` table |
| `000003` | `users` table |
| `000004` | RBAC: `permissions`, `roles`, `role_permissions`, `user_tenant_roles` |
| `000005` | `integrations`, `integration_tenants` |
| `000006` | `posts` table |
| `000007` | `reports` table (evolved into `campaign_reports`) |
| `000008` | `campaigns` table |
| `000009` | `metrics` table |
| `000010` | `alert_events` table |
| `000011` | `agent_runs` table |
| `000013` | Seed ~20 permission records |
| `000014` | FK constraints on `user_tenant_roles` |
| `000015` | `meta_accounts` (deprecated) |
| `000016` | `connector_resources` — unified resource discovery (ADR-005) |
| `000017` | Drop `tenants.google_ads_id` (moved to connector_resources) |
| `000018` | Add `config JSONB` to integrations |
| `000019` | Add `report_prompts JSONB` to tenants |
| `000020` | `campaign_reports` table |
| `000021` | `audit_log` table + audit permissions |

### Core Tables

| Table | Key Fields |
|---|---|
| `tenants` | id, name, language, niche, instructions, hashtags, ads_monitoring (JSONB), report_prompts (JSONB) |
| `users` | id, name, email, password_hash (bcrypt), locale, timezone, is_active |
| `permissions` | id, name (e.g., "create:post", "view-any:tenant") |
| `roles` | id, name, tenant_id (nullable = global) |
| `role_permissions` | role_id → permission_id |
| `user_tenant_roles` | user_id, tenant_id, role_id (composite) |
| `integrations` | id, provider, group, status, encrypted credentials, config JSONB |
| `integration_tenants` | integration_id → tenant_id |
| `connector_resources` | id, tenant_id, integration_id, provider, resource_type, resource_id, resource_name, metadata JSONB |
| `posts` | id, tenant_id, status, content, hashtags[], platforms[], scheduled_date, scheduled_time, published_at |
| `campaigns` | id, tenant_id, slug, data JSONB, deployed_at |
| `campaign_reports` | id, campaign_id, report_content, created_at |
| `metrics` | id, campaign_id, impressions, clicks, cost, conversions, ctr, cpc, roas, details JSONB |
| `alert_events` | id, tenant_id, level (WARN/CRITICAL), type, message, details JSONB, resolved_at, ignored_at |
| `agent_runs` | id, tenant_id, job_type, status, result JSONB, started_at, ended_at |
| `audit_log` | id, tenant_id, user_id, action, entity_type, entity_id, before JSONB, after JSONB, ip, created_at |

### Key Constraints & Indexes

**Unique:**
- `users.email`
- `campaigns(tenant_id, slug)`
- `connector_resources(tenant_id, integration_id, resource_type, resource_id)`

**Indexes:**
- `users(email)`
- `posts(tenant_id)`, `posts(status)`, `posts(tenant_id, scheduled_date)`
- `campaigns(tenant_id)`
- `alert_events(tenant_id, created_at DESC)`, filtered index for open alerts
- `connector_resources(tenant_id, provider, resource_type)`, `(integration_id)`
- `audit_log(tenant_id, created_at DESC)`, `(tenant_id, entity_type, entity_id)`, `(tenant_id, user_id)`

---

## 6. Integrations & Connectors

### 14 Providers

| Provider | Group | Purpose |
|---|---|---|
| Google Ads | ads | Campaign management, live metrics, history sync, mutations |
| Meta | social_media | Facebook/Instagram OAuth, page discovery, post publishing |
| Anthropic (Claude) | llm | AI content generation |
| OpenAI | llm | AI content generation |
| Google Gemini | llm | AI content generation |
| Groq | llm | AI content generation |
| Kimi | llm | AI content generation |
| Brevo | email | Email marketing |
| Resend | email | Transactional email |
| AWS S3 | storage | File storage |
| Cloudflare R2 | storage | File storage |
| Sentry | monitoring | Error tracking |
| Local filesystem | storage | Default fallback |

### Google Ads Connector

Files: `backend/internal/connector/googleads/`

| File | Responsibility |
|---|---|
| `client.go` | HTTPS client to `https://googleads.googleapis.com/v23`, token refresh |
| `campaigns.go` | List campaigns, fetch live data |
| `metrics.go` | Query impressions, clicks, CPC, CPA, ROAS |
| `detail.go` | Devices, hourly, keywords, search terms, quality scores, impression share |
| `consolidate.go` | Aggregate into daily snapshots |
| `history.go` | Fetch historical campaign data |
| `mutate.go` | Update campaign settings (bid strategy, budget) |

### LLM Provider Registry

`provider/llm/registry.go` — singleton backed by `sync.Map`

**Fallback priority:** Claude → OpenAI → Gemini → Groq → Kimi

`ProviderSelector` returns the first connected provider for a given tenant. The tenant does not need to know which LLM is active — the system chooses automatically.

### Connector Resources Model (ADR-005)

Instead of separate tables per provider, a single `connector_resources` table holds all discovered external resources:

```
integrations (credentials)
    ↓ 1:N
connector_resources (discovered accounts/pages/buckets)
    provider: google_ads | meta | r2 | tiktok | linkedin | ...
    resource_type: ad_account | page | bucket | ...
    resource_id: external ID
    metadata: JSONB (provider-specific data)
```

This design means adding a new provider (TikTok, LinkedIn) requires zero schema changes.

---

## 7. MCP Server

### Endpoint

`/mcp` — HTTP Streamable transport  
Auth: `MCP_API_KEY` header (required in production)

### Tools (15+)

**Content Tools:**
- `list_tenants` — List all clients
- `get_tenant` — Get tenant config by ID
- `create_tenant` — Create new client
- `list_posts` — List posts (by status, date range)
- `get_post` — Get post by ID
- `create_post` — Create post
- `update_post` — Update post content
- `delete_post` — Delete post
- `list_campaigns` — List saved campaigns
- `get_campaign` — Get campaign by slug
- `create_campaign` — Create campaign

**Ads Tools:**
- `list_live_campaigns` — Fetch live Google Ads campaigns (real-time)
- `get_live_campaign_detail` — Detailed metrics for one campaign
- `sync_campaign_history` — Pull historical data

**LLM Tools:**
- `generate_content` — Stream AI content generation

**Monitoring Tools:**
- `list_alerts` — Active alerts for a tenant
- `get_metrics` — Campaign KPIs

### Resources (read-only, for linking in responses)

- `maestro://tenants/{tenantId}`
- `maestro://posts/{postId}`
- `maestro://campaigns/{campaignId}`

### Strategic Value

The MCP server is the largest competitive differentiator. No current marketing SaaS competitor (Hootsuite, Sprout Social, Swydo) exposes an MCP interface. This means:

1. Any Claude-based agent can control the full marketing cycle without a UI
2. Agencies can build custom automation workflows on top of Maestro via agents
3. The platform becomes the "MCP backend for marketing agencies" — a layer, not just a tool

**Current gap:** No RBAC on MCP. One API key grants access to all tenants. Acceptable for alpha, must be fixed before cloud launch.

---

## 8. Scheduler & Automation

### Scheduler (`backend/internal/scheduler/scheduler.go`)

- Runs every **1 minute**
- Iterates all tenants with `AdsMonitoringConfig`
- Executes jobs based on config flags:

| Flag | Action |
|---|---|
| `SyncEnabled=true` | Pull latest campaign metrics → store in `metrics` |
| `AIReportDaily=true` | Generate AI report at configured time → store in `campaign_reports` |
| `AIReportWeekly=true` | Weekly aggregated AI report |
| `AIReportMonthly=true` | Monthly aggregated AI report |
| `AdjustmentsEnabled=true` | Auto-apply campaign adjustments within variance limits |
| Alert thresholds | Create `alert_events` if CPA > max, no conversions for N days, etc. |

All runs logged to `agent_runs` with status + result JSONB.

### Automatic Campaign Editor

**Status:** Partially implemented. Infrastructure exists, decision logic incomplete.

**What exists:**
- `mutate.go` — Google Ads API mutations (update bid strategy, budget)
- `AdsMonitoringConfig` fields: `MaxIncreasePct`, `MaxDecreasePct`, `AdjustmentsEnabled`
- `agent_runs` for job history
- `alert_events` for outcome tracking

**What is missing:**
- Decision engine: given metrics delta, calculate adjustment proposal
- Validation against variance limits before applying
- "Pending approval" queue for manual review (`AdjustmentsEnabled=false`)
- Audit trail entry for every auto-applied change

**Target flow:**
```
Scheduler runs daily
  → Fetch last 7d metrics for each campaign
  → Calculate performance delta vs. targets (CPA, ROAS)
  → Compute proposed adjustment (bid ± X%, budget ± Y%)
  → Validate: proposed change within MaxIncreasePct / MaxDecreasePct
  → AdjustmentsEnabled=true  → Apply via mutate.go + log to audit_log
  → AdjustmentsEnabled=false → Save as pending suggestion (UI notification)
  → Record in agent_runs (succeeded/failed + details JSONB)
```

**Risk note:** Google Ads API has strict rate limits on mutations. Campaigns modified with unusual frequency risk manual review or account suspension. The variance limits (`MaxIncreasePct`, `MaxDecreasePct`) are not just UX — they are compliance safety rails.

---

## 9. Security Analysis

### What is implemented well

| Mechanism | Implementation |
|---|---|
| Password hashing | bcrypt cost 12 |
| Session tokens | JWT HS256, short-lived (~1h) + HTTP-only cookie refresh token |
| Credential storage | AES-256-GCM with CREDENTIAL_ENCRYPTION_KEY env var |
| SQL injection | sqlc parameterized queries — impossible by construction |
| XSS | CSP headers + input sanitization |
| Clickjacking | X-Frame-Options: DENY |
| CORS | Whitelist on admin endpoints |
| Login brute force | Rate limit: 3 req/min per IP |
| Security headers | HSTS, X-Content-Type-Options, Referrer-Policy |
| Audit trail | Before/after JSONB on all entity changes |

### Gaps to address

**1. MCP has no RBAC**  
A single `MCP_API_KEY` grants full access to all tenants. If the key leaks, all tenant data is exposed. Priority: high before cloud launch.

**2. No refresh token rotation**  
Current pattern appears to use a static refresh token. Recommended: rotation on each use — if old token is used after rotation, flag as potential compromise.

**3. CREDENTIAL_ENCRYPTION_KEY loss = total data loss**  
If the key is lost or rotated without migration, all stored OAuth credentials (Google Ads, Meta) become unreadable. Documentation and backup procedures are critical for self-hosted deployments.

**4. Scheduler has no distributed lock**  
With multiple server instances, the scheduler runs simultaneously on all, duplicating reports and alerts. Must be fixed with `SELECT FOR UPDATE SKIP LOCKED` or equivalent before horizontal scaling.

---

## 10. Testing Suite

### Backend

| Layer | Command | Coverage |
|---|---|---|
| Unit | `make test/backend/unit` | Crypto (AES-256-GCM), JWT, bcrypt, middleware auth |
| Integration | `make test/backend/integration` | All 12 repositories — **86.5% coverage** |
| Smoke | `make smoke` | 7 contract tests: health, auth, protected routes, MCP |

**Test infrastructure:** Embedded PostgreSQL (no Docker required for tests). Race detector enabled on all unit tests.

### Frontend

| Layer | Command | Count |
|---|---|---|
| API specs | `make test/frontend` | 159 Vitest tests (CRUD coverage for every API module) |
| Component | `make test/frontend` | 99 browser tests (Playwright + Vitest) |
| E2E | `make test/e2e` | 10 Playwright tests (auth flows, post creation golden path) |

### CI Pipeline (10 jobs)

1. Go Lint (golangci-lint)
2. Go Build + vet
3. Go Unit Tests (race detector + Codecov)
4. Go Integration Tests (Postgres service)
5. Security Scan (gosec)
6. Frontend Quality (ESLint, Prettier, TypeScript check)
7. Frontend Tests (Vitest unit + browser)
8. Frontend Build (SvelteKit)
9. Smoke Tests
10. Gate Job (final pass/fail)

---

## 11. DevOps & CI/CD

### Docker Compose

```yaml
services:
  postgres:  # PostgreSQL 16, port 5432
  minio:     # S3-compatible storage, ports 9000/9001 (optional)
```

### Makefile Targets

```bash
# Development
make dev/backend     # Go with air (hot reload)
make dev/frontend    # SvelteKit Vite dev server
make dev/bundle      # All services in parallel

# Database
make migrate/up      # Apply all pending migrations
make migrate/down    # Rollback last migration
make migrate/status  # Show migration state
make migrate/create  # Create new migration file

# Testing
make test/backend           # All backend tests
make test/backend/unit      # Unit tests + race detector
make test/backend/integration # Integration tests
make test/backend/cover     # Coverage report
make test/frontend          # Vitest + browser tests
make test/e2e               # Playwright E2E
make smoke                  # Smoke tests

# Quality
make lint    # golangci-lint + ESLint/Prettier
make sqlc    # Regenerate SQL bindings
```

### Required Environment Variables

```bash
PORT=8080
APP_ENV=development|production
DATABASE_URL=postgres://user:pass@host:5432/mkt_maestro
JWT_SECRET=<32+ chars>
CREDENTIAL_ENCRYPTION_KEY=<16/24/32 bytes>
MCP_API_KEY=<random, required in production>
ADMIN_CORS_ORIGINS=http://localhost:5173
COOKIE_DOMAIN=<.domain.com in production>
BASE_URL=http://localhost:8080
SENTRY_DSN=<optional>
STORAGE_PATH=./storage/images
DEV_FRONTEND_URL=http://localhost:5173
```

---

## 12. Open Source Strategy

### Model

- **Core platform:** 100% open source, self-hosted via Docker
- **Revenue:** Cloud managed offering (hosted by maintainer) + donations
- **API credentials:** Single Meta App + Google Ads Developer Token maintained by project owner, distributed to all self-hosted installations

### The Centralized Credentials Insight

Each self-hosted installation uses the **project owner's** approved Meta App ID and Google Ads Developer Token. This means:

- Agencies skip the Meta App Review process (2-4 weeks, can fail)
- Agencies skip the Google Ads developer token approval process (2-6 weeks)
- One approval benefits all installations
- The maintainer bears compliance responsibility for all users

**This is the real moat:** The approval process validates the *flow and intent* of the app, not who installs it. Once approved, the system is identical across all deployments.

### Risks of Centralized Credentials

| Risk | Mitigation |
|---|---|
| Key revocation kills all installations | Terms of use, monitoring, abuse detection |
| Google Ads rate limits per developer token | Monitor usage; Standard Access has higher limits |
| Meta terms of service for credential sharing | Legal review; common pattern in open source |
| Maintainer as single point of failure | Document self-credential path for large agencies |

### Cloud Offer

Agencies that do not want to self-host pay for the managed version. Key value propositions:
1. No DevOps required
2. Pre-approved API credentials (instant connection to Meta/Google Ads)
3. Backups and updates managed
4. SLA support

The self-hosting friction (Docker, env vars, migrations, key management) will naturally convert a significant portion of interested agencies to the cloud offering.

---

## 13. Strengths

### Architecture
- Clean separation: handler → repository → sqlc → postgres
- No global state (except LLM registry, protected by sync.Map)
- Dependencies injected via constructors
- Domain layer isolated from infrastructure

### Security
- AES-256-GCM for all credentials at rest
- bcrypt cost 12 for passwords
- JWT + HTTP-only cookie pattern
- Rate limiting on auth endpoints
- CSP + full security headers
- Parameterized queries via sqlc (SQL injection impossible)

### Schema Design
- `connector_resources` unified model scales to unlimited providers
- JSONB for volatile config fields avoids frequent migrations
- Comprehensive indexes on all filter/sort columns
- Append-only `audit_log` for full traceability

### Testing
- 86.5% repository coverage
- 159 + 99 frontend tests
- Embedded Postgres (no test Docker dependency)
- Full CI pipeline with 10 parallel jobs

### MCP Differentiation
- No marketing SaaS competitor has MCP
- Enables agent-driven automation without UI
- Platform becomes programmable infrastructure

---

## 14. Risks & Gaps

### Critical (block production)

| Gap | Impact | Fix |
|---|---|---|
| MCP has no RBAC | One key exposes all tenants | Tenant-scoped auth on MCP |
| No refresh token rotation | Token theft undetectable | Rotation on each use |
| Scheduler no distributed lock | Duplicate jobs on scale-out | SELECT FOR UPDATE SKIP LOCKED |
| CREDENTIAL_ENCRYPTION_KEY backup | Key loss = all OAuth credentials lost | Documented backup + rotation procedure |

### High (block alpha release)

| Gap | Impact | Fix |
|---|---|---|
| No Docker setup documentation | Self-hosters can't start | README with complete setup guide |
| No Meta App Review guide | Agencies stuck on OAuth production | Step-by-step guide in docs |
| No Google Ads Developer Token guide | Agencies stuck on API access | Step-by-step guide in docs |
| No startup migration check | Schema mismatch on update → crash | Auto-check migrations on startup |
| Campaign editor decision logic missing | Core feature incomplete | Implement adjustment engine |
| Meta connector half-implemented | Social publishing unreliable | Complete webhooks + status tracking |

### Medium (pre-cloud)

| Gap | Impact | Fix |
|---|---|---|
| No frontend cache layer | Every navigation refetches all data | TanStack Query or SvelteKit load caching |
| No pagination verification | List endpoints may OOM on large datasets | Audit all List* for LIMIT/OFFSET |
| MCP tools incomplete | Agents can't execute full cycle | Complete ads mutation + approval queue tools |
| JSONB creep | Complex queries become unreadable | Audit which JSONB fields are filtered |
| No semantic versioning | Update instructions unclear | CHANGELOG.md + semver tags |

---

## 15. Roadmap Priorities

Based on the analysis, the recommended implementation order for reaching alpha:

### Phase 1 — Complete Core Features

**1. Automatic Campaign Editor** *(highest value, most complex)*
- Implement decision engine (metrics delta → adjustment proposal)
- Validate against `MaxIncreasePct` / `MaxDecreasePct` limits
- Build approval queue for `AdjustmentsEnabled=false` mode
- Wire into scheduler daily job
- Add before/after to `audit_log`

**2. Reports Scheduler** *(rides the same daily cycle)*
- Complete daily/weekly/monthly report generation
- Store in `campaign_reports`
- Expose via MCP tool
- Trigger notifications (email via Brevo/Resend)

**3. Meta Connector** *(complete social publishing)*
- Webhook receiver (`/webhooks/meta`) with signature validation
- Post status sync (published / failed)
- Multi-page selection per tenant
- Instagram Reels / Stories handling
- Error recovery flow

### Phase 2 — Platform Hardening

**4. MCP Refinement**
- Tenant-scoped authentication
- Complete ads mutation tools (campaign editor via agent)
- Approval queue tool (list/approve/reject pending adjustments)
- Rate limiting per API key

**5. Self-Hosting Documentation**
- Complete Docker setup guide
- Meta App Review walkthrough
- Google Ads Developer Token walkthrough
- `CREDENTIAL_ENCRYPTION_KEY` backup guide
- Update/migration guide

**6. Operational Robustness**
- Startup migration version check
- Distributed lock for scheduler
- Paginaton audit on all List endpoints

### Phase 3 — Cloud Launch

**7. Cloud Infrastructure**
- Multi-tenant hosted deployment
- Centralized Meta App + Google Ads credentials (pre-approved)
- Billing integration
- Monitoring dashboard

**8. Additional Connectors**
- TikTok Ads
- LinkedIn Ads
- Pinterest

---

## Appendix: Technology Versions

| Component | Version |
|---|---|
| Go | 1.25.10 |
| SvelteKit | 5.x |
| Svelte | 5.x (runes) |
| Bun | Latest |
| PostgreSQL | 16 |
| pgx | v5 |
| chi | v5 |
| Tailwind | v4 |
| Playwright | Latest |
| goose | v3 |
| sqlc | v2 |
| golangci-lint | Latest |

---

*This document was generated via full codebase analysis on 2026-05-17 and reflects the state of the project at that date. Update after each major milestone.*
