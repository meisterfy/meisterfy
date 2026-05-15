---
title: "test: backend unit — middleware (admin-auth, rate-limit, cors, logging, tenant-match)"
created: 2026-05-15T14:32:44.733Z
priority: P1-M
status: backlog
tags: [test]
---

# test: backend unit — middleware (admin-auth, rate-limit, cors, logging, tenant-match)

## Context
`internal/middleware/` has 31 functions and zero tests. This middleware is the security boundary of the entire API — it handles JWT validation, RBAC enforcement, rate limiting (with IP detection), tenant isolation, CORS, and request logging. Any regression here is directly exploitable.

## Files to create
- `backend/internal/middleware/admin_auth_test.go`
- `backend/internal/middleware/rate_limit_test.go`
- `backend/internal/middleware/tenant_match_test.go`
- `backend/internal/middleware/cors_test.go`
- `backend/internal/middleware/logging_test.go`

## No build tags — pure unit tests using httptest

Pattern for all middleware tests:
```go
package middleware

import (
    "net/http"
    "net/http/httptest"
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func okHandler() http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    })
}
```

---

## `admin_auth_test.go`

Under test: `AdminAuth(jwtSvc *domain.JWTService, required ...string) func(http.Handler) http.Handler`

```go
func TestAdminAuth_NoAuthorizationHeader(t *testing.T) { ... }     // → 401
func TestAdminAuth_MalformedBearer(t *testing.T) { ... }           // "Bearer" without token → 401
func TestAdminAuth_InvalidToken(t *testing.T) { ... }              // garbage JWT → 401
func TestAdminAuth_ExpiredToken(t *testing.T) { ... }              // issue with -1s TTL → 401
func TestAdminAuth_ValidToken_NoPermission(t *testing.T) { ... }   // valid JWT, wrong perm → 403
func TestAdminAuth_ValidToken_HasPermission(t *testing.T) { ... }  // → 200, claims in context
func TestAdminAuth_ClaimsStoredInContext(t *testing.T) { ... }     // verify GetUserClaims(ctx) returns claims
```

Use `domain.NewJWTService("test-secret")` to issue real test tokens — do not mock the JWT service.

---

## `rate_limit_test.go`

Under test: `RateLimitLogin(max int, window time.Duration) func(http.Handler) http.Handler`

```go
func TestRateLimitLogin_AllowsUnderLimit(t *testing.T) { ... }     // max-1 requests → all 200
func TestRateLimitLogin_BlocksAtLimit(t *testing.T) { ... }        // max+1 requests → last is 429
func TestRateLimitLogin_ResetsAfterWindow(t *testing.T) { ... }    // uses synctest or short window
func TestRateLimitLogin_IsolatesByIP(t *testing.T) { ... }         // IP-A blocked, IP-B still allowed
func TestRateLimitLogin_RealIP_XRealIP(t *testing.T) { ... }       // X-Real-IP header used as key
func TestRateLimitLogin_RealIP_XForwardedFor(t *testing.T) { ... } // X-Forwarded-For fallback
func TestRateLimitLogin_RealIP_RemoteAddr(t *testing.T) { ... }    // RemoteAddr fallback
```

For window reset: use a very short window (10ms) and `time.Sleep` just enough, OR use `testing/synctest` if available.

---

## `tenant_match_test.go`

Under test: `RequireTenantMatch` — ensures the tenantID in the JWT claims matches the `{tenantId}` URL param.

```go
func TestRequireTenantMatch_Match(t *testing.T) { ... }    // claims.TenantID == URL param → 200
func TestRequireTenantMatch_Mismatch(t *testing.T) { ... } // different tenant → 403
func TestRequireTenantMatch_NoParam(t *testing.T) { ... }  // no chi param → check behavior
func TestRequireTenantMatch_NoClaims(t *testing.T) { ... } // no claims in context → 401
```

Use `chi.NewRouter()` and `chi.URLParam` to properly set route params.

---

## `cors_test.go`

Under test: `CORS()` middleware.

```go
func TestCORS_AllowedOrigin(t *testing.T) { ... }           // OPTIONS → 204, Access-Control-* headers set
func TestCORS_NonOptionsRequest(t *testing.T) { ... }       // GET passes through with headers
```

---

## `logging_test.go`

Under test: `RequestLogger()` — verify it doesn't panic and passes requests through.

```go
func TestRequestLogger_PassesThrough(t *testing.T) { ... }  // → 200, no panic
func TestRequestLogger_LogsOnError(t *testing.T) { ... }    // handler returns 500 → logged
```

Capture log output with `slog.NewTextHandler` pointing to a `bytes.Buffer`.

---

## Patterns
- All test functions: `t.Parallel()`
- Use `github.com/go-chi/chi/v5` router for tests that need URL params
- Use real `domain.JWTService` (not mocked) for auth tests
- Table-driven where there are multiple cases for the same function

## Acceptance criteria
- `go test -race -count=1 ./internal/middleware/...` passes
- All 7 functions in `admin_auth.go`, `rate_limit.go`, `tenant_match` covered
- No test takes >100ms (all in-memory)

## Dependencies
- TASK-051 (uses domain.JWTService to issue test tokens)
- TASK-050 for testify (or add manually: `go get github.com/stretchr/testify`)


