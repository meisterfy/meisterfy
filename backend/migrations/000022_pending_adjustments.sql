-- +goose Up
CREATE TABLE pending_adjustments (
    id                   TEXT             PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id            TEXT             NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_resource_id TEXT             NOT NULL REFERENCES connector_resources(id) ON DELETE CASCADE,
    adjustment_type      TEXT             NOT NULL,
    current_value        DOUBLE PRECISION NOT NULL,
    proposed_value       DOUBLE PRECISION NOT NULL,
    reason               TEXT             NOT NULL,
    status               TEXT             NOT NULL DEFAULT 'pending',
    expires_at           TIMESTAMPTZ,
    resolved_at          TIMESTAMPTZ,
    resolved_by          TEXT             REFERENCES users(id),
    created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX ON pending_adjustments(tenant_id, status, created_at DESC);
CREATE INDEX ON pending_adjustments(campaign_resource_id);
CREATE INDEX ON pending_adjustments(status, expires_at) WHERE status = 'pending';

-- +goose Down
DROP TABLE IF EXISTS pending_adjustments;
