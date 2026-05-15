---
title: "Workflow RBAC Enforcement + Audit Log"
created: 2026-05-15T00:33:10.146Z
priority: P1-L
status: backlog
tags: [feat]
---

# Workflow RBAC Enforcement + Audit Log

## Goal

Enforce granular workflow permissions on the post status-change endpoint, and add a full audit trail for every mutation in the system.

---

## Current State

**RBAC foundation is solid:**
- `middleware.RequirePermission(perm)` exists and works — it reads claims from JWT context.
- 31 permissions seeded in `000013_seed_permissions.sql`, including `review:post`, `approve:post`, `schedule:post`, `publish:post`.
- 6 roles defined: owner, manager, content_creator, content_approver, scheduler, client_viewer.

**Gap — workflow permissions not enforced:**
- `PATCH /admin/tenants/{tenantId}/posts/{id}/status` has **no** `RequirePermission` middleware.
- Any authenticated user can change post status to anything.

**Gap — no audit log:**
- No `audit_log` table, no repository, no API, no UI.

---

## Implementation Plan

### Phase 1 — Enforce post workflow permissions (small, do first)

In `backend/internal/api/admin_posts.go`, the `UpdateStatus` handler decodes `{ status: string }`. Add permission enforcement **inside the handler** (not as middleware, since it depends on the new status value):

```
"draft"     → no extra permission (creator can always save draft)
"review"    → require review:post
"approved"  → require approve:post
"scheduled" → require schedule:post
"published" → require publish:post
```

Use `middleware.UserClaimsFromContext(r.Context())` then `claims.HasPermission(perm)`. Return 403 with `domain.ErrForbidden` message if not met.

Write a test in `backend/internal/api/` or `backend/internal/repository/` for this logic.

---

### Phase 2 — Audit log migration + repository

**Migration** `000021_audit_log.sql`:

```sql
CREATE TABLE audit_log (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL,
    user_name   TEXT NOT NULL,
    action      TEXT NOT NULL,        -- e.g. "post.status_changed", "post.created", "campaign.updated"
    entity_type TEXT NOT NULL,        -- "post", "campaign", "integration", "user", "role"
    entity_id   TEXT NOT NULL,
    entity_name TEXT,                 -- human-readable label for the UI
    before      JSONB,
    after       JSONB,
    ip          TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_idx ON audit_log(tenant_id, created_at DESC);
CREATE INDEX audit_log_entity_idx ON audit_log(tenant_id, entity_type, entity_id);
CREATE INDEX audit_log_user_idx ON audit_log(tenant_id, user_id);
```

**sqlc query** (`backend/internal/repository/queries/audit_log.sql`):
```sql
-- name: InsertAuditLog :exec
INSERT INTO audit_log (id, tenant_id, user_id, user_name, action, entity_type, entity_id, entity_name, before, after, ip)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);

-- name: ListAuditLog :many
SELECT * FROM audit_log
WHERE tenant_id = $1
  AND ($2::text IS NULL OR user_id = $2)
  AND ($3::text IS NULL OR entity_type = $3)
  AND ($4::text IS NULL OR entity_id = $4)
ORDER BY created_at DESC
LIMIT $5 OFFSET $6;
```

Run `make sqlc` to regenerate.

**AuditLogRepository** (`backend/internal/repository/audit_log.go`) — `Log(ctx, entry)` and `List(ctx, filter)` methods.

---

### Phase 3 — Wire audit logging in mutation handlers

Create a helper `audit.Log(ctx, pool, entry AuditEntry)` so handlers don't need to import the full repository. Each handler that mutates state should call it **after a successful DB write**, non-blocking (fire-and-forget with a detached context so it never fails the request).

Handlers to instrument (minimum viable):
- `admin_posts.go`: Create, Update, UpdateStatus, Delete
- `admin_tenants.go`: Create, Update, Delete
- `admin_users.go`: Create, Update, Delete, AssignRole
- `admin_integrations.go`: Create, Update, Delete

The `before` field should capture the entity state **before** the mutation. For Create actions, `before` is null.

The `ip` field should come from `r.Header.Get("X-Real-IP")` (chi's RealIP middleware already normalizes this).

---

### Phase 4 — API endpoint

Route: `GET /admin/tenants/{tenantId}/audit-log`

Query params: `user_id`, `entity_type`, `entity_id`, `limit` (default 50, max 200), `offset`.

Response:
```json
{
  "data": [{ "id": "...", "user_name": "...", "action": "...", "entity_type": "...", "entity_name": "...", "created_at": "..." }],
  "total": 142
}
```

Register with `RequirePermission("view-any:user")` (owners/managers only).

---

### Phase 5 — Frontend UI

Route: `/[tenant]/settings/audit` (add to the settings sidebar).

A filterable table showing the audit log:
- Columns: timestamp, user, action, entity type, entity name
- Filters: entity_type dropdown, date range
- Pagination (50 per page)
- Clicking a row expands it to show `before`/`after` JSON diff (simple two-column JSON display, no fancy diff library needed)

---

## Files to create/modify

**Backend (new):**
- `backend/migrations/000021_audit_log.sql`
- `backend/internal/repository/queries/audit_log.sql`
- `backend/internal/repository/db/audit_log.sql.go` (generated by sqlc)
- `backend/internal/repository/audit_log.go`

**Backend (modify):**
- `backend/internal/api/admin_posts.go` — workflow permission enforcement + audit calls
- `backend/internal/api/admin_tenants.go` — audit calls
- `backend/internal/api/admin_users.go` — audit calls
- `backend/internal/api/admin_integrations.go` — audit calls
- `backend/cmd/server/main.go` — wire AuditLogRepository, add route

**Frontend (new):**
- `frontend/src/routes/[tenant]/settings/audit/+page.svelte`
- `frontend/src/routes/[tenant]/settings/audit/+page.ts`
- `frontend/src/lib/api/audit.ts`

**Frontend (modify):**
- Settings sidebar navigation to include Audit Log link
- `frontend/locales/en/settings.json` + `frontend/locales/pt-BR/settings.json` — i18n keys

---

## Definition of Done

- [ ] `PATCH /posts/{id}/status` returns 403 when caller lacks the required workflow permission
- [ ] `audit_log` table exists and is migrated
- [ ] Every successful mutation in posts, tenants, users, integrations writes an audit entry
- [ ] `GET /admin/tenants/{tenantId}/audit-log` returns paginated results
- [ ] Frontend `/[tenant]/settings/audit` shows filterable audit table
- [ ] `go build ./...` and `bun run build` pass clean

