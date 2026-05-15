---
title: "fix: N+1 in user list, swallowed errors, audit actor fix, main.go indentation"
created: 2026-05-15T14:02:07.183Z
priority: P2-M
status: backlog
tags: [fix]
---

# fix: N+1 in user list, swallowed errors, audit actor fix, main.go indentation

## Context

A full quality review identified 4 medium-priority issues in the backend. None are security blockers (those are TASK-047 and TASK-048) but they represent correctness and observability problems that should be fixed before go-live.

> **Important:** Do NOT use Superpowers skills or any skill beyond the project's built-in Go/Svelte skills. Use only MCP tools, project skills, and direct tool calls.

---

## Fix 1 — N+1 query in `GET /admin/users`

**File:** `backend/internal/api/admin_users.go:71-84`

**Problem:** `List` fetches all users with `ListForTenant`, then calls `GetRoleForUser` once per user inside a loop. The `NPlus1Detector` middleware already flags this on every request.

**Fix:** Add a batch method `GetRolesForUsers` to `RBACRepository` that fetches all roles for a slice of user IDs in a single query, then update `AdminUsersHandler.List` to call it once.

**Repository addition** (`backend/internal/repository/rbac.go`):

```go
// GetRolesForUsers returns a map[userID]→Role for all given userIDs within tenantID.
// Users without a role are absent from the map.
func (r *RBACRepository) GetRolesForUsers(ctx context.Context, userIDs []string, tenantID string) (map[string]*domain.Role, error) {
    if len(userIDs) == 0 {
        return map[string]*domain.Role{}, nil
    }
    const q = `
        SELECT r.id, r.name, r.tenant_id, utr.user_id
        FROM roles r
        JOIN user_tenant_roles utr ON utr.role_id = r.id
        WHERE utr.user_id = ANY($1) AND utr.tenant_id = $2
    `
    rows, err := r.pool.Query(ctx, q, userIDs, tenantID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := make(map[string]*domain.Role, len(userIDs))
    for rows.Next() {
        var role domain.Role
        var tid *string
        var uid string
        if err := rows.Scan(&role.ID, &role.Name, &tid, &uid); err != nil {
            return nil, err
        }
        role.TenantID = tid
        out[uid] = &role
    }
    return out, rows.Err()
}
```

**Handler update** (`backend/internal/api/admin_users.go`, `List` method):

```go
func (h *AdminUsersHandler) List(w http.ResponseWriter, r *http.Request) {
    claims := middleware.UserClaimsFromContext(r.Context())
    users, err := h.userRepo.ListForTenant(r.Context(), claims.TenantID)
    if err != nil {
        InternalError(w)
        return
    }
    // Single batch query instead of N individual GetRoleForUser calls.
    ids := make([]string, len(users))
    for i, u := range users {
        ids[i] = u.ID
    }
    roles, _ := h.rbacRepo.GetRolesForUsers(r.Context(), ids, claims.TenantID)

    data := make([]userAdminResponse, len(users))
    for i, u := range users {
        resp := toUserAdminResponse(u)
        if role, ok := roles[u.ID]; ok {
            resp.Role = &roleRef{ID: role.ID, Name: role.Name}
        }
        data[i] = resp
    }
    JSON(w, http.StatusOK, map[string]any{"data": data})
}
```

Update the `rbacRepo` interface inside `AdminUsersHandler` and `NewAdminUsersHandler` to include `GetRolesForUsers`. Remove `GetRoleForUser` from the interface only if it is no longer used by `List` (it is still used by `Get`, `Update`, `Delete`, and `AssignRole`, so keep it).

---

## Fix 2 — Errors silently swallowed in two write operations

### 2a — `SetTenants` in integration update

**File:** `backend/internal/api/admin_integrations.go` — `Update` method

**Problem:**
```go
_ = h.repo.SetTenants(r.Context(), id, tenantIDs)  // error ignored
```
If the tenant association fails, the caller gets a 200 with the old tenant list and no indication of the failure.

**Fix:** Handle the error and return 500:
```go
if tenantIDs != nil {
    if err := h.repo.SetTenants(r.Context(), id, tenantIDs); err != nil {
        InternalError(w)
        return
    }
    ig.TenantIDs = tenantIDs
}
```

### 2b — `RemoveAllRolesForUserInTenant` in role assignment

**File:** `backend/internal/api/admin_users.go` — `AssignRole` method

**Problem:**
```go
_ = h.rbacRepo.RemoveAllRolesForUserInTenant(r.Context(), userID, tenantID)
```
If the revocation fails but the assignment succeeds, the user ends up with two roles. The operation should be atomic or the error surfaced.

**Fix:** Wrap both calls in a simple check — if removal fails, abort before assigning:
```go
if err := h.rbacRepo.RemoveAllRolesForUserInTenant(r.Context(), userID, tenantID); err != nil {
    InternalError(w)
    return
}
if err := h.rbacRepo.AssignRole(r.Context(), userID, tenantID, req.RoleID); err != nil {
    InternalError(w)
    return
}
```

---

## Fix 3 — Audit log for `tenant.created` records the wrong actor tenant

**File:** `backend/internal/api/admin_tenants.go` — `Create` method, lines ~163-170

**Problem:**
```go
h.audit.AsyncLog(domain.AuditEntry{
    TenantID: created.ID,  // ← the newly created tenant, not the admin's tenant
    ...
})
```
Super-admins creating tenants have the audit entry filed under the brand-new tenant, not their own. This makes the super-admin's audit trail incomplete.

**Fix:** Use the actor's tenant ID from claims, and add the created tenant ID as the entity:
```go
if claims != nil && h.audit != nil {
    h.audit.AsyncLog(domain.AuditEntry{
        TenantID:   claims.TenantID,   // actor's tenant (super-admin's own tenant)
        UserID:     claims.UserID,
        UserName:   claims.UserName,
        Action:     "tenant.created",
        EntityType: "tenant",
        EntityID:   created.ID,        // the tenant that was created
        EntityName: &created.Name,
        After:      toTenantResponse(created),
        IP:         auditIP(r),
    })
}
```

---

## Fix 4 — Misleading `r.Group` indentation in `main.go`

**File:** `backend/cmd/server/main.go`

**Problem:** Two timeout-group closures have their inner `r.Route`, `r.Get`, and `r.Group` calls at the same indentation level as the enclosing `r.Group(...)` call. The code is functionally correct but looks like the routes are outside the timeout group. Future developers may accidentally register routes outside the group.

**Fix:** Re-indent all route/middleware registrations that live inside each `r.Group(func(r chi.Router) { r.Use(chimw.Timeout(...)) ... })` closure so they are one tab level deeper than the `r.Group(...)` call. No logic changes.

The two affected blocks are:
- Lines ~192–303 (main timeout group covering `/auth`, `/admin`, `/api/media`)
- Lines ~312–329 (second timeout group covering `/admin/tenants/{tenantId}/ai` and `/admin/tenants/{tenantId}/google-ads`)

---

## Acceptance criteria

- [ ] `go build ./...` passes
- [ ] `go vet ./...` passes
- [ ] `GET /admin/users` no longer triggers the `NPlus1Detector` warning in logs
- [ ] `PUT /admin/integrations/{id}` with an invalid tenant ID in `tenant_ids` returns 500, not 200 with a silently wrong tenant list
- [ ] `PUT /admin/users/{id}/role` with a DB error during role removal returns 500 and does not assign the new role
- [ ] Creating a new tenant as a super-admin produces an audit entry with `tenant_id = super-admin's own tenant`, not the newly created tenant's ID
- [ ] In `main.go`, every `r.Route` / `r.Get` / inner `r.Group` that is inside a `chimw.Timeout` group is indented one level deeper than the `r.Group(...)` call itself


