---
title: "test: infra — replace testcontainers with embedded-postgres, add build tags and TestMain"
created: 2026-05-15T14:31:51.921Z
priority: P1-M
status: backlog
tags: [test]
---

# test: infra — replace testcontainers with embedded-postgres, add build tags and TestMain

## Context
The current test infrastructure uses `github.com/testcontainers/testcontainers-go` which requires a Docker daemon. Docker is only used in production, not available in all dev environments or CI. This task replaces testcontainers with `github.com/fergusstrange/embedded-postgres`, which runs a real Postgres binary without Docker.

## Why
- `go test ./...` breaks in environments without Docker (CI without backend job, WSL without Docker daemon)
- Each test function spins up a new container — 20+ containers per `go test`, extremely slow
- No `//go:build integration` tags — integration tests and unit tests are indistinguishable
- `ResetDB` has a hardcoded table list that silently misses new tables added by migrations

## What to do

### 1. Add dependency
```bash
cd backend && go get github.com/fergusstrange/embedded-postgres@latest
```
Remove `github.com/testcontainers/testcontainers-go` and `github.com/testcontainers/testcontainers-go/modules/postgres` from go.mod after migration.

### 2. Rewrite `backend/testutil/db.go`
Replace the entire file. New logic:
- If `TEST_DATABASE_URL` env var is set → connect directly (for CI with `services: postgres`, or local with real Postgres)
- Otherwise → start `embedded-postgres` on a random port, run goose migrations, return pool
- Use `t.Cleanup()` to stop embedded postgres and close pool
- Expose `SharedContainer` pattern via `TestMain` (see step 3)

```go
package testutil

import (
    "context"
    "database/sql"
    "fmt"
    "math/rand"
    "os"
    "path/filepath"
    "runtime"
    "testing"

    _ "github.com/jackc/pgx/v5/stdlib"
    "github.com/jackc/pgx/v5/pgxpool"
    embeddedpostgres "github.com/fergusstrange/embedded-postgres"
    "github.com/pressly/goose/v3"
)

type PostgresContainer struct {
    Pool     *pgxpool.Pool
    DSN      string
    embedded *embeddedpostgres.EmbeddedPostgres // nil if external
}

func NewPostgresContainer(t testing.TB) *PostgresContainer {
    t.Helper()
    dsn := os.Getenv("TEST_DATABASE_URL")
    if dsn != "" {
        return connectExternal(t, dsn)
    }
    return startEmbedded(t)
}

func startEmbedded(t testing.TB) *PostgresContainer { ... }
func connectExternal(t testing.TB, dsn string) *PostgresContainer { ... }
```

- `ResetDB` must use dynamic truncate — query `information_schema.tables` for all user tables and truncate them, instead of a hardcoded list.

### 3. Add `TestMain` to each repository test package
Each package under `backend/internal/repository/` needs a `TestMain` that shares ONE `PostgresContainer` across all tests in the package. This replaces one-container-per-function.

Create `backend/internal/repository/main_test.go`:
```go
//go:build integration

package repository

import (
    "os"
    "testing"
    "github.com/rush-maestro/rush-maestro/testutil"
)

var sharedDB *testutil.PostgresContainer

func TestMain(m *testing.M) {
    sharedDB = testutil.NewPostgresContainer(nil) // nil = use global setup
    code := m.Run()
    sharedDB.Cleanup(context.Background())
    os.Exit(code)
}
```

Update all `*_test.go` files in `repository/` to:
- Add `//go:build integration` at top
- Use `sharedDB` instead of calling `testutil.NewPostgresContainer(t)` per function
- Call `sharedDB.ResetDB(t)` at the start of each test function that needs isolation

### 4. Add `goleak` and `testify` as real (non-indirect) dependencies
```bash
cd backend && go get go.uber.org/goleak@latest
cd backend && go get github.com/stretchr/testify@latest
```

Add to `repository/main_test.go` TestMain:
```go
import "go.uber.org/goleak"
// wrap: goleak.VerifyTestMain(m)
```

### 5. Add golangci-lint config (if missing)
Create `backend/.golangci.yml` with at minimum:
```yaml
linters:
  enable:
    - govet
    - errcheck
    - staticcheck
    - unused
    - gosimple
    - ineffassign
    - typecheck
```

## Files to touch
- `backend/testutil/db.go` — full rewrite
- `backend/testutil/fixtures.go` — no change needed
- `backend/internal/repository/main_test.go` — new file
- `backend/internal/repository/*_test.go` — add build tag, swap to sharedDB
- `backend/go.mod` / `backend/go.sum` — add embedded-postgres, goleak; remove testcontainers
- `backend/.golangci.yml` — create if missing

## Acceptance criteria
- `go test ./...` (no tags) finishes in <5s without Docker (only unit tests run)
- `go test -tags=integration ./internal/repository/...` passes with embedded-postgres
- `TEST_DATABASE_URL=postgres://... go test -tags=integration ./...` works in CI
- ONE embedded postgres instance per package, not per test function
- `ResetDB` dynamically truncates all tables (no hardcoded list)

## Dependencies
None — this is the foundation for all other test tasks.


