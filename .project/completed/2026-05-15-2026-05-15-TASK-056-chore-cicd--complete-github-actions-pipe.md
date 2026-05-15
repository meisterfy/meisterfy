---
title: "chore: CI/CD — complete GitHub Actions pipeline (backend + frontend + security + coverage gate)"
created: 2026-05-15T14:34:38.486Z
priority: P1-M
status: backlog
tags: [chore]
---

# chore: CI/CD — complete GitHub Actions pipeline (backend + frontend + security + coverage gate)

## Context
The current `ci.yml` has only one job (frontend) and silences the format check with `|| true`. The Go backend is never compiled, tested, or linted in CI. This task replaces the entire CI/CD pipeline with a production-grade setup.

## File to rewrite
`.github/workflows/ci.yml` — full replacement.

## Complete pipeline spec

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ===================== BACKEND =====================

  go-lint:
    name: Go — Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: backend/go.mod
          cache: true
      - uses: golangci/golangci-lint-action@v6
        with:
          working-directory: backend
          version: latest

  go-build:
    name: Go — Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: backend/go.mod
          cache: true
      - name: Build
        working-directory: backend
        run: go build ./...
      - name: Vet
        working-directory: backend
        run: go vet ./...

  go-test-unit:
    name: Go — Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: backend/go.mod
          cache: true
      - name: Unit tests with race detector and coverage
        working-directory: backend
        run: go test -race -count=1 -coverprofile=coverage.out -covermode=atomic ./...
      - name: Show coverage summary
        working-directory: backend
        run: go tool cover -func=coverage.out | tail -1
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: backend/coverage.out
          flags: backend-unit
          fail_ci_if_error: false

  go-test-integration:
    name: Go — Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: backend/go.mod
          cache: true
      - name: Run goose migrations
        working-directory: backend
        run: go run ./cmd/migrate up
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/testdb?sslmode=disable
      - name: Integration tests
        working-directory: backend
        run: go test -tags=integration -race -count=1 ./...
        env:
          TEST_DATABASE_URL: postgres://test:test@localhost:5432/testdb?sslmode=disable

  go-security:
    name: Go — Security (govulncheck)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: backend/go.mod
          cache: true
      - name: Install govulncheck
        run: go install golang.org/x/vuln/cmd/govulncheck@latest
      - name: Run govulncheck
        working-directory: backend
        run: govulncheck ./...

  # ===================== FRONTEND =====================

  frontend-quality:
    name: Frontend — Quality (format + lint + typecheck)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Install dependencies
        working-directory: frontend
        run: bun install --frozen-lockfile
      - name: Format check
        working-directory: frontend
        run: bun run format -- --check          # NO || true
      - name: Lint
        working-directory: frontend
        run: bun run lint
      - name: Type check
        working-directory: frontend
        run: bun run check

  frontend-test:
    name: Frontend — Unit & Component Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Install dependencies
        working-directory: frontend
        run: bun install --frozen-lockfile
      - name: Install Playwright browsers
        working-directory: frontend
        run: bunx playwright install chromium --with-deps
      - name: Run tests with coverage
        working-directory: frontend
        run: bun run test:unit -- --run --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: frontend/coverage/coverage-final.json
          flags: frontend
          fail_ci_if_error: false

  frontend-build:
    name: Frontend — Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Install dependencies
        working-directory: frontend
        run: bun install --frozen-lockfile
      - name: Build
        working-directory: frontend
        run: bun run build

  # ===================== GATE =====================

  all-checks:
    name: All Checks Passed
    runs-on: ubuntu-latest
    if: always()
    needs:
      - go-lint
      - go-build
      - go-test-unit
      - go-test-integration
      - go-security
      - frontend-quality
      - frontend-test
      - frontend-build
    steps:
      - name: Check all jobs
        run: |
          results='${{ toJSON(needs) }}'
          if echo "$results" | grep -q '"result":"failure"'; then
            echo "One or more jobs failed"
            exit 1
          fi
          echo "All checks passed"
```

## Additional files to create/update

### `.golangci.yml` (in `backend/`)
```yaml
run:
  timeout: 5m
  tests: true

linters:
  enable:
    - errcheck
    - govet
    - staticcheck
    - unused
    - gosimple
    - ineffassign
    - typecheck
    - gosec
    - noctx
    - bodyclose
    - sqlclosecheck
    - revive
    - testifylint   # enforce testify best practices
    - paralleltest  # enforce t.Parallel()

linters-settings:
  revive:
    rules:
      - name: exported
      - name: error-return

issues:
  exclude-rules:
    - path: _test\.go
      linters: [gosec]
```

### Update `vite.config.ts` — add coverage config
```typescript
test: {
  expect: { requireAssertions: true },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    include: ['src/lib/**'],
    exclude: ['src/lib/paraglide/**', 'src/lib/vitest-examples/**'],
    thresholds: {
      lines: 30,
      functions: 30,
    }
  },
  projects: [ ... ] // unchanged
}
```

### Update `Makefile` — add `test/backend/unit` and `test/backend/integration`
```makefile
test/backend/unit:
	cd backend && go test -race -count=1 ./...

test/backend/integration:
	cd backend && go test -tags=integration -race -count=1 ./...

test/backend/cover:
	cd backend && go test -race -coverprofile=coverage.out ./... && go tool cover -html=coverage.out
```

## Acceptance criteria
- PR from any branch triggers all jobs
- `go-build` fails if `go build ./...` fails — currently no gate exists
- `go-test-unit` runs with `-race` and uploads coverage to Codecov
- `go-test-integration` uses GitHub postgres service (no Docker in Go code)
- Format check (`prettier --check`) blocks merge if formatting is wrong
- `all-checks` job is the single required status check for branch protection
- `concurrency` cancels stale runs on force-push

## Dependencies
- TASK-050 (integration tests need `TEST_DATABASE_URL` support in testutil + build tags)
- No other test tasks are blockers — `go-test-unit` will pass even with low coverage


