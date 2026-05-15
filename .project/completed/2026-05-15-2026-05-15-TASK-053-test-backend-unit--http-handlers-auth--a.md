---
title: "test: backend unit — HTTP handlers auth + admin-posts + admin-integrations (httptest + mocks)"
created: 2026-05-15T14:33:16.536Z
priority: P1-L
status: backlog
tags: [test]
---

# test: backend unit — HTTP handlers auth + admin-posts + admin-integrations (httptest + mocks)

## Context
`internal/api/` has 129 HTTP handler functions with zero tests. Handlers are the public contract of the API — they encode HTTP semantics (status codes, payloads, auth enforcement). This task covers the three highest-traffic handler groups: auth, posts, and integrations.

No database needed — all repositories are injected as interfaces, so mock implementations suffice.

## Strategy
Each handler file already depends on interface-typed repos. Create mock structs in `_test.go` files that implement those interfaces. Use `httptest.NewRecorder` + `httptest.NewRequest`.

## Files to create
- `backend/internal/api/auth_test.go`
- `backend/internal/api/admin_posts_test.go`
- `backend/internal/api/admin_integrations_test.go`

## Shared test helper (put in `backend/internal/api/testhelpers_test.go`)
```go
package api

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
    "github.com/go-chi/chi/v5"
    "github.com/rush-maestro/rush-maestro/internal/domain"
)

func newTestRouter(h http.Handler) *chi.Mux {
    r := chi.NewRouter()
    // mount without auth middleware so tests control auth via context
    return r
}

func withClaims(r *http.Request, claims *domain.UserClaims) *http.Request {
    // inject claims into context using the same key as middleware
}

func decodeJSON(t *testing.T, w *httptest.ResponseRecorder, v any) {
    t.Helper()
    require.Equal(t, "application/json", w.Header().Get("Content-Type"))
    require.NoError(t, json.NewDecoder(w.Body).Decode(v))
}
```

---

## `auth_test.go`

Under test: `AuthHandler` in `backend/internal/api/auth.go` — Login, Refresh, Logout.

```go
type mockUserRepo struct { /* implements domain.UserRepository */ }
type mockSessionRepo struct { /* implements domain.SessionRepository */ }

func TestAuthHandler_Login_Success(t *testing.T) { ... }          // valid creds → 200, tokens in body
func TestAuthHandler_Login_WrongPassword(t *testing.T) { ... }    // → 401
func TestAuthHandler_Login_UserNotFound(t *testing.T) { ... }     // → 401 (same message — no enumeration)
func TestAuthHandler_Login_InvalidJSON(t *testing.T) { ... }      // → 400
func TestAuthHandler_Login_MissingFields(t *testing.T) { ... }    // table-driven: missing email, missing password
func TestAuthHandler_Refresh_ValidToken(t *testing.T) { ... }     // → 200, new access token
func TestAuthHandler_Refresh_InvalidToken(t *testing.T) { ... }   // → 401
func TestAuthHandler_Refresh_ExpiredToken(t *testing.T) { ... }   // → 401
func TestAuthHandler_Logout_Success(t *testing.T) { ... }         // → 204, session deleted
func TestAuthHandler_Logout_NoClaims(t *testing.T) { ... }        // → 401
```

---

## `admin_posts_test.go`

Under test: `AdminPostsHandler` in `backend/internal/api/admin_posts.go`.

```go
type mockPostRepo struct {
    posts   []*domain.Post
    createErr, updateErr, deleteErr error
}

func TestAdminPosts_List_ReturnsTenantPosts(t *testing.T) { ... }     // → 200, JSON array
func TestAdminPosts_List_EmptyResult(t *testing.T) { ... }            // → 200, []
func TestAdminPosts_List_FilterByStatus(t *testing.T) { ... }         // ?status=draft
func TestAdminPosts_Get_Found(t *testing.T) { ... }                   // → 200
func TestAdminPosts_Get_NotFound(t *testing.T) { ... }                // → 404
func TestAdminPosts_Create_Valid(t *testing.T) { ... }                // → 201
func TestAdminPosts_Create_InvalidJSON(t *testing.T) { ... }          // → 400
func TestAdminPosts_Create_MissingContent(t *testing.T) { ... }       // → 422
func TestAdminPosts_Update_Valid(t *testing.T) { ... }                // → 200
func TestAdminPosts_Update_NotFound(t *testing.T) { ... }             // → 404
func TestAdminPosts_Delete_Valid(t *testing.T) { ... }                // → 204
func TestAdminPosts_Delete_NotFound(t *testing.T) { ... }             // → 404
func TestAdminPosts_TenantIsolation(t *testing.T) { ... }             // claims.TenantID != URL param → 403 (middleware, but verify handler respects it)
```

---

## `admin_integrations_test.go`

Under test: `AdminIntegrationsHandler` in `backend/internal/api/admin_integrations.go`.

```go
type mockIntegrationRepo struct { ... }

func TestAdminIntegrations_List(t *testing.T) { ... }               // → 200
func TestAdminIntegrations_Get_Found(t *testing.T) { ... }          // → 200
func TestAdminIntegrations_Get_NotFound(t *testing.T) { ... }       // → 404
func TestAdminIntegrations_Create_Valid(t *testing.T) { ... }       // → 201
func TestAdminIntegrations_Create_DuplicateProvider(t *testing.T) { ... } // → 409 if applicable
func TestAdminIntegrations_Update_Valid(t *testing.T) { ... }       // → 200
func TestAdminIntegrations_Update_SetTenants(t *testing.T) { ... }  // tenant list updated
func TestAdminIntegrations_Delete_Valid(t *testing.T) { ... }       // → 204
func TestAdminIntegrations_SetTenants_EmptyList(t *testing.T) { ... }
```

---

## Patterns
- All test files: `package api` (white-box, same package)
- `t.Parallel()` at top of every `Test*` function
- Table-driven for input validation (missing fields, invalid JSON, etc.)
- Mock repos return pre-configured data via struct fields — no `testify/mock` framework needed (simple struct satisfying interface)
- Check both status code AND response body shape
- Use `require.Equal(t, http.StatusOK, w.Code)` — fail fast on wrong status before body decode

## Acceptance criteria
- `go test -race -count=1 ./internal/api/...` passes (only unit tests, no DB)
- Auth, posts, and integrations handlers: >80% coverage
- Every non-2xx path (400, 401, 403, 404, 422) tested at least once per handler
- No test >50ms

## Dependencies
- TASK-050 (testify as real dep)
- TASK-051 (domain.JWTService for issuing test claims)
- TASK-052 (understand middleware contract — claims in context key)


