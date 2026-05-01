-- +goose Up
CREATE TABLE meta_accounts (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    integration_id  TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    page_id         TEXT NOT NULL,
    page_name       TEXT,
    ig_user_id      TEXT,
    ig_username     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meta_accounts_tenant_id ON meta_accounts (tenant_id);
CREATE INDEX idx_meta_accounts_integration_id ON meta_accounts (integration_id);

-- +goose Down
DROP TABLE IF EXISTS meta_accounts;
