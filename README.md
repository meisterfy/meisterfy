# Meisterfy

AI-assisted marketing management platform for agencies — Social Media scheduling, Google Ads management, AI content generation, and an MCP server. Everything managed through the UI, no CLI required.

**Stack:** Go 1.22+ (chi, pgx/v5, goose) · SvelteKit 5 (Svelte runes, Tailwind v4) · PostgreSQL 16 · Docker Compose

---

## Architecture

```
Go Backend  (port 8080 — SPA embedded in binary for production)
  ├── GET  /health                          health check + setup detection
  ├── POST /setup                           first-run admin account creation
  ├── /auth/*                               JWT login/refresh/logout, OAuth (Google Ads, Meta)
  ├── /admin/*                              REST API — users, roles, tenants, posts,
  │                                         campaigns, alerts, reports, integrations
  ├── GET|DELETE /api/media/{tenant}/{id}   media serve & delete
  ├── POST /api/media/{tenant}/{postId}     media upload (JWT-gated)
  ├── POST /ai/generate                     AI content (SSE stream, JWT-gated)
  └── /mcp                                  MCP endpoint (Streamable HTTP, API-key auth)

SvelteKit SPA  (port 5173 in dev)
  ├── /login  /setup                        public pages
  ├── /tenants/new                          onboarding
  ├── /[tenant]/social                      post planner (calendar + drawers)
  ├── /[tenant]/social/drafts               draft management
  ├── /[tenant]/campaigns/*                 Google Ads live & history
  ├── /[tenant]/alerts                      monitoring alerts
  ├── /[tenant]/reports                     AI reports
  └── /settings/*                           integrations, users, roles
```

---

## Connection System

Credentials are stored in the `integrations` table (encrypted). Connecting in the UI unlocks features:

| Category | Providers |
|----------|-----------|
| LLM | OpenAI, Gemini, Kimi, Groq, Claude (Anthropic) |
| Storage | S3, R2 |
| Ads (OAuth2) | Google Ads |
| Social (OAuth2) | Meta (Instagram) |
| Email | Resend, Brevo |
| Tracking | Sentry |

---

## Quick Start

**Prerequisites:** Go 1.22+, Bun 1.x, Docker, [air](https://github.com/air-verse/air), [goose](https://github.com/pressly/goose), [golangci-lint](https://golangci-lint.run/usage/install/), sqlc

```bash
docker compose up -d
cp backend/.env.example backend/.env   # set DATABASE_URL + JWT_SECRET (openssl rand -hex 32)
cd frontend && bun install && cd ..
make migrate/up
make dev/bundle
```

Open `http://localhost:5173` — the setup wizard creates the first admin account.

---

## Makefile Reference

```
Development
  make dev/backend         Go backend (air hot-reload)
  make dev/frontend        SvelteKit dev server
  make dev/bundle          All processes in parallel (recommended)

Build
  make build               Build frontend + Go binary

Migrations
  make migrate/up          Apply all pending migrations
  make migrate/down        Rollback last migration
  make migrate/status      Show migration state
  make migrate/create      Interactive: create a new migration file

Testing
  make test/backend        Go tests (all)
  make test/backend/unit   Go unit tests with race detector
  make test/backend/integration  Integration tests (requires Postgres)
  make test/backend/cover  Coverage report (opens browser)
  make smoke               Smoke tests against localhost:8080
  make smoke/remote URL=…  Smoke tests against a remote URL
  make test/frontend       Vitest unit + browser component tests
  make test/e2e            Playwright E2E tests (requires running stack)
  make test/e2e/ui         Playwright interactive UI mode
  make test/e2e/report     Open last Playwright HTML report

Quality
  make lint                golangci-lint + ESLint/Prettier
  make sqlc                Regenerate sqlc query bindings
```

---

## Test Suite

### Backend

| Layer | Command | What it covers |
|-------|---------|----------------|
| Unit | `make test/backend/unit` | Crypto (AES-256-GCM), JWT, password hashing, middleware, HTTP handlers |
| Integration | `make test/backend/integration` | Repository layer against embedded Postgres — 86.5% coverage |
| Smoke | `make smoke` | 7 contract tests (health, auth endpoints, protected routes, MCP) |

Build tags: `//go:build integration` and `//go:build smoke`.

### Frontend

| Layer | Command | What it covers |
|-------|---------|----------------|
| API specs | `make test/frontend` | 159 Vitest tests — full CRUD for every API client module |
| Component | `make test/frontend` | 99 browser component tests via Playwright + Vitest |
| E2E | `make test/e2e` | 10 Playwright tests — auth flows, protected routes, post creation golden path |

E2E tests require a running stack and credentials:

```bash
E2E_USER_EMAIL=admin@example.com E2E_USER_PASSWORD=yourpassword make test/e2e
```

To test the first-run setup flow against a fresh DB: `E2E_FRESH_DB=true make test/e2e`.

---

## CI/CD

**`ci.yml`** — every push and PR to `main`: lint → build → unit tests → integration tests → security scan → frontend quality → frontend tests → frontend build → smoke tests → gate job.

**`e2e.yml`** — push to `main` and manual dispatch only: spins up full stack (Postgres → migrations → backend → frontend build), creates a test user, runs the 10 Playwright E2E tests. Requires GitHub Secrets `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`. Playwright report uploaded as artifact on failure.
