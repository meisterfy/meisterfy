-- +goose Up

CREATE TABLE audit_log (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL,
    user_name   TEXT NOT NULL,
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    entity_name TEXT,
    before      JSONB,
    after       JSONB,
    ip          TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_tenant_idx ON audit_log(tenant_id, created_at DESC);
CREATE INDEX audit_log_entity_idx ON audit_log(tenant_id, entity_type, entity_id);
CREATE INDEX audit_log_user_idx   ON audit_log(tenant_id, user_id);

INSERT INTO permissions (id, name) VALUES
    ('perm_integration_view', 'view:integrations')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.id IN ('role_owner', 'role_manager')
  AND p.name = 'view:integrations'
ON CONFLICT DO NOTHING;

-- +goose Down

DROP TABLE IF EXISTS audit_log;

DELETE FROM role_permissions
WHERE permission_id = 'perm_integration_view';

DELETE FROM permissions WHERE id = 'perm_integration_view';
