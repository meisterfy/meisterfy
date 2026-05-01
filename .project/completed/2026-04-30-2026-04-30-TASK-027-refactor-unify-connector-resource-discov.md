---
title: "Refactor: Unify connector resource discovery into connector_resources table"
created: 2026-04-30T21:32:20.942Z
priority: P1-S
status: backlog
tags: [refactor]
---

# Refactor: Unify connector resource discovery into connector_resources table

## Context

Currently every connector invents its own way to store discovered resources:
- **Google Ads** stores the client account ID in `tenants.google_ads_id`.
- **Meta** (just built) uses a dedicated `meta_accounts` table.
- **R2/S3** has no place to store bucket/endpoint info at all.
- **LLMs** need no extra resources (just an API key).

This will explode into `tiktok_accounts`, `linkedin_accounts`, etc. as new connectors are added. We need a single, generic, typed abstraction for **all** connector resource discovery.

## Proposed Architecture

### 1. Database (Migration)

Create `connector_resources` table and seed it from existing data:

```sql
CREATE TABLE connector_resources (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    provider       TEXT NOT NULL,   -- 'meta', 'google_ads', 'r2', 's3', ...
    resource_type  TEXT NOT NULL,   -- 'page', 'ig_account', 'ad_account', 'bucket'
    resource_id    TEXT NOT NULL,   -- provider-scoped ID
    resource_name  TEXT,            -- human-readable label
    metadata       JSONB NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_connector_resources_lookup ON connector_resources(tenant_id, provider, resource_type);
CREATE INDEX idx_connector_resources_integration ON connector_resources(integration_id);
```

- Migrate all rows from `meta_accounts` into `connector_resources`.
- Migrate `tenants.google_ads_id` into `connector_resources` (`provider='google_ads', resource_type='ad_account'`).
- Add `integration_id` FK linkage for Google Ads (currently missing since it lives on tenant).

### 2. Domain Model

```go
package domain

type ConnectorResource struct {
    ID            string
    TenantID      string
    IntegrationID string
    Provider      IntegrationProvider
    ResourceType  string
    ResourceID    string
    ResourceName  *string
    Metadata      map[string]any
    CreatedAt     time.Time
    UpdatedAt     time.Time
}
```

### 3. Repository

```go
package repository

type ConnectorResourceRepository struct{ ... }

func (r *ConnectorResourceRepository) List(
    ctx context.Context,
    tenantID string,
    provider domain.IntegrationProvider,
    resourceType string,
) ([]*domain.ConnectorResource, error)

func (r *ConnectorResourceRepository) Upsert(
    ctx context.Context,
    res *domain.ConnectorResource,
) error

func (r *ConnectorResourceRepository) DeleteByTenantProvider(
    ctx context.Context,
    tenantID string,
    provider domain.IntegrationProvider,
) error

func (r *ConnectorResourceRepository) GetByID(ctx context.Context, id string) (*domain.ConnectorResource, error)
```

Add SQLC queries in `queries/connector_resources.sql`, regenerate code, add tests.

### 4. Connector Interface Extension

Extend `connector.IntegrationSchema` with an optional discovery hook:

```go
type IntegrationSchema struct {
    // ... existing fields ...

    // DiscoverResources is called after a successful OAuth connection.
    // It fetches resources from the provider API and persists them.
    DiscoverResources func(ctx context.Context, integration *domain.Integration, store ResourceStore) error `json:"-"`
}

// ResourceStore is the generic persistence interface.
type ResourceStore interface {
    DeleteByTenantProvider(ctx context.Context, tenantID string, provider domain.IntegrationProvider) error
    Upsert(ctx context.Context, res *domain.ConnectorResource) error
    List(ctx context.Context, tenantID string, provider domain.IntegrationProvider, resourceType string) ([]*domain.ConnectorResource, error)
}
```

### 5. Meta Refactor

- **Remove** `domain.MetaAccount`, `repository.MetaAccountRepository`, `meta_accounts.sql` queries, and the `meta_accounts` table.
- **Update** `internal/connector/meta/client.go` — `GetAccounts()` and `GetIGAccount()` return `[]domain.ConnectorResource`.
- **Update** `internal/api/oauth_meta.go` — callback uses `connector.ResourceStore` to upsert discovered pages/IG accounts with `provider='meta'`.
- **Update** `internal/api/meta_publish.go` — handler reads from `ConnectorResourceRepository` instead of `MetaAccountRepository`; selects accounts via `resource_type='page'` or `'ig_account'`.
- **Update** frontend API types — remove `MetaAccount`, use `ConnectorResource` with typed metadata helpers.

### 6. Google Ads Refactor

- **Update** `internal/connector/googleads/client.go` / `makeAdsFactory` in `main.go` — resolve the Google Ads `customer_id` from `connector_resources` (`provider='google_ads', resource_type='ad_account'`) instead of `tenant.GoogleAdsID`.
- **Update** tenant setup flow — when creating a tenant, store the Google Ads ID as a `ConnectorResource` linked to the tenant's Google Ads integration.
- **Migration** — move existing `tenants.google_ads_id` values into `connector_resources`.
- **Optional**: deprecate `tenants.google_ads_id` column (drop in future migration after data migration).

### 7. Storage Connector (R2/S3) Prep

- **Update** `internal/connector/storage/schema.go` — register bucket/region as `resource_type='bucket'` in the schema description.
- No functional changes yet (storage is not fully wired), but the schema should document that discovered buckets go into `connector_resources`.

### 8. Frontend Refactor

- **Create** `src/lib/api/connector_resources.ts`:
  ```ts
  export interface ConnectorResource {
    id: string
    tenant_id: string
    integration_id: string
    provider: string
    resource_type: string
    resource_id: string
    resource_name: string | null
    metadata: Record<string, unknown>
  }
  export const getConnectorResources = (tenantId: string, provider: string, resourceType: string) => ...
  ```
- **Update** `drafts/+page.ts` and `drafts/+page.svelte` — replace `getMetaAccounts` with `getConnectorResources(data.tenant, 'meta', 'page')` and filter by `resource_type` for platform selection.
- **Update** publish drawer to show `resource_name` and extract `ig_user_id` from `metadata`.

### 9. Tests

- Unit tests for `ConnectorResourceRepository` (CRUD, List filters).
- Unit tests for Meta `DiscoverResources` callback mock.
- Ensure existing LLM registry tests still pass.
- Build check: `go build ./...` and `go vet ./...` clean.
- Frontend build: `npm run build` passes.

## Files to Touch

- `backend/migrations/000016_connector_resources.sql` (new)
- `backend/internal/repository/queries/connector_resources.sql` (new)
- `backend/internal/repository/db/*` (regenerate via sqlc)
- `backend/internal/domain/connector_resource.go` (new)
- `backend/internal/repository/connector_resource.go` (new)
- `backend/internal/connector/schema.go` (extend `IntegrationSchema`)
- `backend/internal/connector/registry.go` (no change, but verify)
- `backend/internal/connector/meta/client.go` (refactor return types)
- `backend/internal/connector/meta/schema.go` (add `DiscoverResources` hook)
- `backend/internal/api/oauth_meta.go` (use generic store)
- `backend/internal/api/meta_publish.go` (use generic store)
- `backend/cmd/server/main.go` (wire new repo, refactor `makeAdsFactory`)
- `backend/internal/connector/googleads/client.go` or factory (resolve customer_id from resources)
- `backend/internal/domain/meta_account.go` (delete)
- `backend/internal/repository/meta_account.go` (delete)
- `backend/internal/repository/queries/meta_accounts.sql` (delete)
- `frontend/src/lib/api/meta.ts` (delete or merge into connector_resources)
- `frontend/src/lib/api/connector_resources.ts` (new)
- `frontend/src/routes/[tenant]/social/drafts/+page.ts` (use new API)
- `frontend/src/routes/[tenant]/social/drafts/+page.svelte` (use new types)

## Definition of Done

- [ ] `meta_accounts` table dropped, data migrated to `connector_resources`.
- [ ] `tenants.google_ads_id` data migrated to `connector_resources`.
- [ ] Meta OAuth callback discovers pages/IG via generic `ResourceStore`.
- [ ] Meta publish endpoint reads accounts from `connector_resources`.
- [ ] Google Ads factory resolves customer ID from `connector_resources`.
- [ ] Frontend publish drawer uses generic connector resource API.
- [ ] `go build ./...` passes, `go vet ./...` clean.
- [ ] Frontend `npm run build` passes.
- [ ] Unit tests for repository logic pass (or Docker unavailable noted).

## Related

- TASK-025 (Meta Connector) — this refactor replaces the `meta_accounts` approach introduced there.


