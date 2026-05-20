-- +goose Up
CREATE TABLE mcp_api_keys (
    id           TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id    TEXT         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    key_prefix   VARCHAR(12)  NOT NULL,
    key_hash     VARCHAR(64)  NOT NULL UNIQUE,
    role         VARCHAR(20)  NOT NULL DEFAULT 'readonly',
    created_by   TEXT         REFERENCES users(id),
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ON mcp_api_keys(tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX ON mcp_api_keys(key_hash);

INSERT INTO permissions (id, name) VALUES ('perm_mcp_keys_manage', 'manage:mcp-keys')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_owner', 'perm_mcp_keys_manage'
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM role_permissions WHERE permission_id = 'perm_mcp_keys_manage';
DELETE FROM permissions WHERE id = 'perm_mcp_keys_manage';
DROP TABLE IF EXISTS mcp_api_keys;
