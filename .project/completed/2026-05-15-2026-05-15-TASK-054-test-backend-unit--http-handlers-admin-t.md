---
title: "test: backend unit — HTTP handlers admin-tenants + admin-users + admin-roles + setup + ai"
created: 2026-05-15T14:33:42.799Z
priority: P1-L
status: backlog
tags: [test]
---

# test: backend unit — HTTP handlers admin-tenants + admin-users + admin-roles + setup + ai

## Context
Continuation of HTTP handler unit tests (TASK-053). This task covers the remaining handler groups: tenant management (multi-tenancy core), user management (RBAC), role assignment, the locked-after-first-user /setup endpoint, and the AI generate endpoint (SSE streaming).

## Files to create
- `backend/internal/api/admin_tenants_test.go`
- `backend/internal/api/admin_users_test.go`
- `backend/internal/api/admin_roles_test.go`
- `backend/internal/api/setup_test.go`
- `backend/internal/api/ai_generate_test.go`

Same shared helpers from TASK-053 (`testhelpers_test.go`) apply here.

---

## `admin_tenants_test.go`

Under test: `AdminTenantsHandler` in `backend/internal/api/admin_tenants.go`.

```go
type mockTenantRepo struct { ... }

func TestAdminTenants_List(t *testing.T) { ... }              // → 200, JSON array
func TestAdminTenants_List_Empty(t *testing.T) { ... }        // → 200, []
func TestAdminTenants_Get_Found(t *testing.T) { ... }         // → 200
func TestAdminTenants_Get_NotFound(t *testing.T) { ... }      // → 404
func TestAdminTenants_Create_Valid(t *testing.T) { ... }      // → 201, ID auto-generated
func TestAdminTenants_Create_DuplicateID(t *testing.T) { ... }// → 409 if repo returns conflict error
func TestAdminTenants_Create_MissingName(t *testing.T) { ... }// → 422
func TestAdminTenants_Update_Valid(t *testing.T) { ... }      // → 200
func TestAdminTenants_Update_NotFound(t *testing.T) { ... }   // → 404
func TestAdminTenants_Delete_Valid(t *testing.T) { ... }      // → 204
```

Verify that audit log is called on Create/Update/Delete (mock an audit repo and assert it was called).

---

## `admin_users_test.go`

Under test: `AdminUsersHandler` in `backend/internal/api/admin_users.go`.

```go
type mockUserRepo struct { ... }
type mockRBACRepo struct { ... }

func TestAdminUsers_List_ForTenant(t *testing.T) { ... }          // scoped to claims.TenantID
func TestAdminUsers_List_Empty(t *testing.T) { ... }
func TestAdminUsers_Get_Found(t *testing.T) { ... }
func TestAdminUsers_Get_NotFound(t *testing.T) { ... }
func TestAdminUsers_Create_Valid(t *testing.T) { ... }            // → 201
func TestAdminUsers_Create_DuplicateEmail(t *testing.T) { ... }   // → 409
func TestAdminUsers_Create_InvalidEmail(t *testing.T) { ... }     // → 422
func TestAdminUsers_Update_Valid(t *testing.T) { ... }
func TestAdminUsers_Delete_SoftDelete(t *testing.T) { ... }       // → 204, is_active=false
func TestAdminUsers_AssignRole_Valid(t *testing.T) { ... }        // removes old role, assigns new
func TestAdminUsers_AssignRole_InvalidRole(t *testing.T) { ... }  // → 422
```

---

## `admin_roles_test.go`

Under test: `AdminRolesHandler` in `backend/internal/api/admin_roles.go`.

```go
func TestAdminRoles_List(t *testing.T) { ... }      // returns all defined roles and their permissions
func TestAdminRoles_Get(t *testing.T) { ... }       // specific role
```

---

## `setup_test.go`

Under test: `SetupHandler` in `backend/internal/api/setup.go`. Critical: /setup must lock after first user is created.

```go
type mockSetupRepo struct {
    userCount int
}

func TestSetup_FirstUser_Succeeds(t *testing.T) { ... }     // userCount=0 → 201
func TestSetup_AlreadySetup_Locked(t *testing.T) { ... }    // userCount=1 → 403 or 404
func TestSetup_MissingEmail(t *testing.T) { ... }           // → 422
func TestSetup_MissingPassword(t *testing.T) { ... }        // → 422
func TestSetup_WeakPassword(t *testing.T) { ... }           // if validation exists → 422
func TestSetup_InvalidJSON(t *testing.T) { ... }            // → 400
```

---

## `ai_generate_test.go`

Under test: SSE streaming endpoint in `backend/internal/api/ai_generate.go`.

```go
type mockLLMSelector struct {
    generateFn func(ctx context.Context, req domain.LLMRequest, stream domain.StreamFunc) (*domain.LLMResponse, error)
}

func TestAIGenerate_StreamsSSE(t *testing.T) { ... }          // → 200, Content-Type: text/event-stream, chunks received
func TestAIGenerate_NoProvider(t *testing.T) { ... }          // selector returns error → 503
func TestAIGenerate_MissingTenantID(t *testing.T) { ... }     // → 400
func TestAIGenerate_EmptyMessages(t *testing.T) { ... }       // → 422
func TestAIGenerate_ContextCancelled(t *testing.T) { ... }    // client disconnects, stream stops cleanly
```

For SSE tests: use `httptest.NewRecorder` with a custom `ResponseWriter` that implements `http.Flusher`. Parse `data:` lines from the response body.

---

## Patterns
- Same as TASK-053: `package api`, `t.Parallel()`, mock interfaces with simple structs
- For audit log assertions: mock repo records calls, assert after handler invocation
- SSE tests: wrap `httptest.NewRecorder` to implement `http.Flusher`
- Table-driven for all validation scenarios

## Acceptance criteria
- `go test -race -count=1 ./internal/api/...` (combined with TASK-053 tests) passes
- admin_tenants.go, admin_users.go, setup.go, ai_generate.go: >75% coverage
- Setup lock (userCount > 0 → locked) is explicitly tested
- SSE streaming tested end-to-end with real chunk parsing

## Dependencies
- TASK-050 (testify)
- TASK-051 (domain types)
- TASK-053 (shared testhelpers_test.go in same package)


