-- name: InsertAuditLog :exec
INSERT INTO audit_log (id, tenant_id, user_id, user_name, action, entity_type, entity_id, entity_name, before, after, ip)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);

-- name: ListAuditLog :many
SELECT * FROM audit_log
WHERE tenant_id = $1
  AND ($2::text IS NULL OR user_id = $2)
  AND ($3::text IS NULL OR entity_type = $3)
  AND ($4::text IS NULL OR entity_id = $4)
ORDER BY created_at DESC
LIMIT $5 OFFSET $6;

-- name: CountAuditLog :one
SELECT COUNT(*) FROM audit_log
WHERE tenant_id = $1
  AND ($2::text IS NULL OR user_id = $2)
  AND ($3::text IS NULL OR entity_type = $3)
  AND ($4::text IS NULL OR entity_id = $4);
