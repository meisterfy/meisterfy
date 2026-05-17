-- name: InsertPendingAdjustment :one
INSERT INTO pending_adjustments (
    id, tenant_id, campaign_resource_id, adjustment_type,
    current_value, proposed_value, reason, status, expires_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
RETURNING *;

-- name: ListPendingAdjustmentsByTenant :many
SELECT * FROM pending_adjustments
WHERE tenant_id = $1
ORDER BY created_at DESC;

-- name: ListPendingAdjustmentsByTenantAndStatus :many
SELECT * FROM pending_adjustments
WHERE tenant_id = $1 AND status = $2
ORDER BY created_at DESC;

-- name: GetPendingAdjustmentByID :one
SELECT * FROM pending_adjustments WHERE id = $1 LIMIT 1;

-- name: ApprovePendingAdjustment :exec
UPDATE pending_adjustments
SET status = 'approved', resolved_at = NOW(), resolved_by = $2
WHERE id = $1;

-- name: RejectPendingAdjustment :exec
UPDATE pending_adjustments
SET status = 'rejected', resolved_at = NOW(), resolved_by = $2
WHERE id = $1;

-- name: ExpireOldPendingAdjustments :execrows
UPDATE pending_adjustments
SET status = 'expired'
WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < NOW();
