# Contributing to Meisterfy

Thank you for your interest in contributing. This document covers everything you need to get started.

## Before You Start

- Check the [open issues](../../issues) to avoid duplicating effort.
- For significant changes, open an issue first to discuss the approach before writing code.
- All contributions are subject to the [AGPL-3.0 license](./LICENSE).

## Development Setup

**Prerequisites:** Go 1.22+, Bun 1.x, Docker, [`air`](https://github.com/air-verse/air), [`goose`](https://github.com/pressly/goose), [`golangci-lint`](https://golangci-lint.run/usage/install/), `sqlc`

```bash
git clone https://github.com/meisterfy/meisterfy.git
cd meisterfy
docker compose up -d
cp backend/.env.example backend/.env   # fill in JWT_SECRET
cd frontend && bun install && cd ..
make migrate/up
make dev/bundle
```

Open `http://localhost:5173` — the setup wizard creates your first admin account.

## Workflow

1. Fork the repository and create a branch from `main`.
2. Write your changes. Run `make lint` before committing.
3. Add or update tests for any logic you touch.
4. Open a pull request against `main` with a clear description of what and why.

All PRs must pass CI before review.

## Commit Style

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add LinkedIn publishing support
fix: prevent duplicate post scheduling on timezone edge case
chore: bump golangci-lint to v1.65
refactor: extract media upload into its own handler
docs: update quick start prerequisites
```

## Code Conventions

- **Backend (Go):** idiomatic Go, no magic globals, context propagation everywhere, errors wrapped with context.
- **Frontend (Svelte):** Svelte 5 runes only, `untrack()` for `$state` initialized from `$props`, kebab-case filenames.
- **SQL:** all queries go through `sqlc` — edit `.sql` files under `backend/internal/repository/queries/`, then run `make sqlc`.
- **Credentials:** never in code or config files — always in the `integrations` table via the UI.

## Testing

```bash
make test/backend/unit        # Go unit tests
make test/backend/integration # integration tests (requires Postgres)
make test/frontend            # Vitest + Playwright component tests
make test/e2e                 # full Playwright E2E (requires running stack)
make lint                     # golangci-lint + ESLint + Prettier
```

All new backend features should have integration tests. Frontend API clients must have Vitest coverage.

## Reporting Issues

Use the GitHub issue tracker. For security vulnerabilities, see [SECURITY.md](./SECURITY.md) instead.
