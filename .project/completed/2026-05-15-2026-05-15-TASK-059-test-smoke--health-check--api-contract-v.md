---
title: "test: smoke — health check + API contract validation (post-deploy, no external services)"
created: 2026-05-15T14:35:49.981Z
priority: P2-S
status: backlog
tags: [test]
---

# test: smoke — health check + API contract validation (post-deploy, no external services)

## Context
Smoke tests validate that a deployed instance is alive and serving the correct API contract — they run against a real running server, not mocks. They are lightweight (no UI automation, no database seeding) and can run in CI after deployment or as a local sanity check.

These are NOT integration tests and NOT unit tests — they live in a separate package and are run explicitly.

## Location
Create `backend/smoke/` package:
```
backend/
  smoke/
    health_test.go
    api_contract_test.go
    smoke_test.go   ← TestMain + shared base URL
```

## Build tag
All smoke tests: `//go:build smoke`

Run with: `go test -tags=smoke ./smoke/...`

---

## `smoke_test.go` — TestMain
```go
//go:build smoke

package smoke

import (
    "os"
    "testing"
)

var baseURL string

func TestMain(m *testing.M) {
    baseURL = os.Getenv("SMOKE_TARGET_URL")
    if baseURL == "" {
        baseURL = "http://localhost:8181" // default for local
    }
    os.Exit(m.Run())
}
```

---

## `health_test.go`
```go
func TestHealth_ReturnsOK(t *testing.T) {
    // GET /health → 200, body contains {"status":"ok"}
}

func TestHealth_ResponseTime(t *testing.T) {
    // GET /health responds in < 500ms
}
```

---

## `api_contract_test.go`
These tests do NOT authenticate — they verify that unauthenticated requests are handled correctly (not that they return data). This validates routing, middleware, and JSON serialization without needing credentials.

```go
func TestSetup_Endpoint_Exists(t *testing.T) {
    // POST /setup with empty body → 400 or 422 (not 404, not 500)
    // Validates setup endpoint is reachable and validates input
}

func TestAuth_Login_Endpoint_Exists(t *testing.T) {
    // POST /auth/login with empty body → 400 or 422 (not 404)
}

func TestAuth_Login_WrongCredentials_Returns401(t *testing.T) {
    // POST /auth/login with {"email":"smoke@test.com","password":"wrong"} → 401
    // NOT 500 — verifies DB is connected and auth logic runs
}

func TestAdminAPI_RequiresAuth(t *testing.T) {
    // GET /admin/tenants/xxx/posts without Authorization header → 401
    // GET /admin/integrations without Authorization header → 401
}

func TestMCP_Endpoint_Exists(t *testing.T) {
    // POST /mcp → not 404 (MCP server is mounted)
}
```

---

## `Makefile` additions
```makefile
smoke:
	cd backend && go test -tags=smoke -v ./smoke/...

smoke/remote:
	cd backend && SMOKE_TARGET_URL=$(URL) go test -tags=smoke -v ./smoke/...
```

Usage: `make smoke` (local) or `make smoke/remote URL=https://staging.example.com`

---

## CI integration (add to TASK-056 pipeline as optional step)
```yaml
smoke-test:
  name: Smoke Tests (local server)
  runs-on: ubuntu-latest
  needs: [go-build]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-go@v5
      with:
        go-version-file: backend/go.mod
        cache: true
    - name: Start server in background
      run: |
        cd backend
        DATABASE_URL="$TEST_DATABASE_URL" go run ./cmd/server &
        sleep 3  # wait for startup
      env:
        TEST_DATABASE_URL: postgres://test:test@localhost:5432/testdb?sslmode=disable
    - name: Run smoke tests
      working-directory: backend
      run: go test -tags=smoke -v ./smoke/...
```

Note: This CI step is optional — add it only when the integration test job (TASK-056) is stable.

---

## Acceptance criteria
- `go test -tags=smoke ./smoke/...` passes against a running local server (`make dev/backend`)
- Health check: <500ms response time asserted in test
- All smoke tests complete in <10s total
- Tests produce clear failure messages identifying WHICH endpoint failed and with WHAT status
- No external service dependencies (no Google Ads, no LLM calls — only /health and /auth)

## Dependencies
- TASK-056 (CI pipeline) — smoke step is added to that workflow
- No other test tasks required — smoke tests are standalone


