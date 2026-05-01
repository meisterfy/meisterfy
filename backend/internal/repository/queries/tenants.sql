-- name: ListTenants :many
SELECT * FROM tenants ORDER BY name;

-- name: GetTenantByID :one
SELECT * FROM tenants WHERE id = $1 LIMIT 1;

-- name: CreateTenant :exec
INSERT INTO tenants (id, name, language, niche, location, primary_persona, tone,
    instructions, hashtags, ads_monitoring)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);

-- name: UpdateTenant :exec
UPDATE tenants
SET name = $2, language = $3, niche = $4, location = $5,
    primary_persona = $6, tone = $7, instructions = $8,
    hashtags = $9, ads_monitoring = $10,
    updated_at = NOW()
WHERE id = $1;

-- name: DeleteTenant :exec
DELETE FROM tenants WHERE id = $1;
