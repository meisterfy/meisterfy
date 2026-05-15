---
title: "test: backend integration — repository refactor (table-driven, parallel, error paths, missing repos)"
created: 2026-05-15T14:34:05.891Z
priority: P2-M
status: backlog
tags: [test]
---

# test: backend integration — repository refactor (table-driven, parallel, error paths, missing repos)

## Context
The 6 existing repository test files work but have gaps: no table-driven structure, no t.Parallel(), no error-path coverage, and the `user`, `rbac`, `metrics`, `audit_log`, `campaign_report`, and `connector_resource` repositories have zero tests. After TASK-050, these tests use shared embedded-postgres via TestMain and `//go:build integration`.

## Prerequisite
TASK-050 must be done first — this task assumes:
- `//go:build integration` already on all repo test files
- `sharedDB *testutil.PostgresContainer` in `main_test.go`
- `sharedDB.ResetDB(t)` available

## What to improve in existing tests

### Convert to table-driven format
Every `TestXxx_Create`, `TestXxx_Update`, etc. should become:
```go
func TestPostRepository_Create(t *testing.T) {
    t.Parallel()
    tests := []struct {
        name    string
        post    *domain.Post
        wantErr bool
    }{
        {"valid minimal post", testutil.NewTestPost("p1", "t1", "content"), false},
        {"missing tenant_id", &domain.Post{ID: "p2"}, true},
        {"duplicate id", testutil.NewTestPost("p1", "t1", "dup"), true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            sharedDB.ResetDB(t)
            // ...
        })
    }
}
```

### Add error-path coverage to existing repos
For each existing test file, add:
- Get non-existent ID → `repository.ErrNotFound`
- Create with duplicate PK → error
- Update non-existent record → error or no-op (document behavior)
- Verify `repository.ErrNotFound` is the sentinel (not raw pgx error)

---

## New test files to create

### `user_test.go`
Under test: `backend/internal/repository/user.go`

```go
func TestUserRepository_CreateAndGet(t *testing.T) { ... }
func TestUserRepository_GetByEmail(t *testing.T) { ... }
func TestUserRepository_GetByEmail_NotFound(t *testing.T) { ... }
func TestUserRepository_Update(t *testing.T) { ... }
func TestUserRepository_SetActive(t *testing.T) { ... }           // soft delete
func TestUserRepository_List(t *testing.T) { ... }
func TestUserRepository_Count(t *testing.T) { ... }               // used by setup lock
```

### `rbac_test.go`
Under test: `backend/internal/repository/rbac.go` — critical for tenant isolation and permission enforcement.

```go
func TestRBACRepository_AssignRole(t *testing.T) { ... }
func TestRBACRepository_GetRoleForUser(t *testing.T) { ... }
func TestRBACRepository_GetRoleForUser_NotAssigned(t *testing.T) { ... }
func TestRBACRepository_GetRolesForUsers_Batch(t *testing.T) { ... }  // N users in one query
func TestRBACRepository_RemoveAllRolesForUserInTenant(t *testing.T) { ... }
func TestRBACRepository_TenantIsolation(t *testing.T) { ... }         // user in tenant-A cannot see tenant-B roles
```

### `metrics_test.go`
Under test: `backend/internal/repository/metrics.go`

```go
func TestMetricsRepository_Upsert(t *testing.T) { ... }
func TestMetricsRepository_List(t *testing.T) { ... }
func TestMetricsRepository_GetMonthlySummary(t *testing.T) { ... }
```

### `audit_log_test.go`
Under test: `backend/internal/repository/audit_log.go`

```go
func TestAuditLogRepository_Log(t *testing.T) { ... }
func TestAuditLogRepository_List(t *testing.T) { ... }
func TestAuditLogRepository_ListByTenant(t *testing.T) { ... }
```

---

## Patterns
- All test files: `//go:build integration` at top
- All test functions: `t.Parallel()` + `sharedDB.ResetDB(t)` at start
- Table-driven for CRUD operations
- Verify `repository.ErrNotFound` specifically (not just "some error")
- Add `testutil.MustCreateUser`, `testutil.MustCreateRBACRole` helper functions to `testutil/fixtures.go`

## Acceptance criteria
- `go test -tags=integration -race ./internal/repository/...` passes
- Coverage on all 9 repository files: >85%
- Every repo operation (Create, Get, Update, Delete, List) has a happy-path and an error-path test
- Tenant isolation tested explicitly in rbac_test.go and integration_test.go

## Dependencies
- TASK-050 (build tags, TestMain, shared container, dynamic ResetDB)


