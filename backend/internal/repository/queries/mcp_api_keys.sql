-- name: InsertMcpApiKey :one
INSERT INTO mcp_api_keys (
    id, tenant_id, name, key_prefix, key_hash, role, created_by, expires_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetMcpApiKeyByHash :one
SELECT * FROM mcp_api_keys
WHERE key_hash = $1 AND revoked_at IS NULL
LIMIT 1;

-- name: ListMcpApiKeysByTenant :many
SELECT id, tenant_id, name, key_prefix, role, created_by, last_used_at, expires_at, revoked_at, created_at
FROM mcp_api_keys
WHERE tenant_id = $1
ORDER BY created_at DESC;

-- name: GetMcpApiKeyByIDAndTenant :one
SELECT * FROM mcp_api_keys
WHERE id = $1 AND tenant_id = $2
LIMIT 1;

-- name: RevokeMcpApiKey :exec
UPDATE mcp_api_keys
SET revoked_at = NOW()
WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL;

-- name: UpdateMcpApiKeyLastUsed :exec
UPDATE mcp_api_keys
SET last_used_at = NOW()
WHERE id = $1;
