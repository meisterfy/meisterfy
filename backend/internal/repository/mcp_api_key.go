package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/repository/db"
)

type McpApiKey struct {
	ID         string
	TenantID   string
	Name       string
	KeyPrefix  string
	Role       string
	CreatedBy  *string
	LastUsedAt *time.Time
	ExpiresAt  *time.Time
	RevokedAt  *time.Time
	CreatedAt  time.Time
}

type McpApiKeyRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewMcpApiKeyRepository(pool *pgxpool.Pool) *McpApiKeyRepository {
	return &McpApiKeyRepository{pool: pool, queries: db.New(pool)}
}

// Create generates a new MCP API key, stores hash+prefix, and returns the full key (only time available).
func (r *McpApiKeyRepository) Create(ctx context.Context, tenantID, createdBy, name, role string, expiresAt *time.Time) (McpApiKey, string, error) {
	fullKey, prefix, hash, err := domain.GenerateMCPKey()
	if err != nil {
		return McpApiKey{}, "", err
	}

	var cb *string
	if createdBy != "" {
		cb = &createdBy
	}

	exp := pgtype.Timestamptz{}
	if expiresAt != nil {
		exp = pgtype.Timestamptz{Time: *expiresAt, Valid: true}
	}

	row, err := r.queries.InsertMcpApiKey(ctx, db.InsertMcpApiKeyParams{
		ID:        domain.NewID(),
		TenantID:  tenantID,
		Name:      name,
		KeyPrefix: prefix,
		KeyHash:   hash,
		Role:      role,
		CreatedBy: cb,
		ExpiresAt: exp,
	})
	if err != nil {
		return McpApiKey{}, "", mapError(err)
	}
	return mapMcpApiKey(row), fullKey, nil
}

// GetByHash looks up a key by its SHA-256 hash (used by auth middleware).
func (r *McpApiKeyRepository) GetByHash(ctx context.Context, keyHash string) (McpApiKey, error) {
	row, err := r.queries.GetMcpApiKeyByHash(ctx, keyHash)
	if err != nil {
		return McpApiKey{}, mapError(err)
	}
	return mapMcpApiKey(row), nil
}

// ListByTenant returns all keys for a tenant, without key_hash.
func (r *McpApiKeyRepository) ListByTenant(ctx context.Context, tenantID string) ([]McpApiKey, error) {
	rows, err := r.queries.ListMcpApiKeysByTenant(ctx, tenantID)
	if err != nil {
		return nil, mapError(err)
	}
	out := make([]McpApiKey, len(rows))
	for i, row := range rows {
		out[i] = mapMcpApiKeyListRow(row)
	}
	return out, nil
}

// Revoke sets revoked_at on a key, verifying tenant ownership.
func (r *McpApiKeyRepository) Revoke(ctx context.Context, id, tenantID string) error {
	return mapError(r.queries.RevokeMcpApiKey(ctx, db.RevokeMcpApiKeyParams{
		ID:       id,
		TenantID: tenantID,
	}))
}

// UpdateLastUsed updates last_used_at to now.
func (r *McpApiKeyRepository) UpdateLastUsed(ctx context.Context, id string) error {
	return mapError(r.queries.UpdateMcpApiKeyLastUsed(ctx, id))
}

func mapMcpApiKey(row db.McpApiKey) McpApiKey {
	k := McpApiKey{
		ID:        row.ID,
		TenantID:  row.TenantID,
		Name:      row.Name,
		KeyPrefix: row.KeyPrefix,
		Role:      row.Role,
		CreatedBy: row.CreatedBy,
		CreatedAt: row.CreatedAt,
	}
	if row.LastUsedAt.Valid {
		t := row.LastUsedAt.Time
		k.LastUsedAt = &t
	}
	if row.ExpiresAt.Valid {
		t := row.ExpiresAt.Time
		k.ExpiresAt = &t
	}
	if row.RevokedAt.Valid {
		t := row.RevokedAt.Time
		k.RevokedAt = &t
	}
	return k
}

func mapMcpApiKeyListRow(row db.ListMcpApiKeysByTenantRow) McpApiKey {
	k := McpApiKey{
		ID:        row.ID,
		TenantID:  row.TenantID,
		Name:      row.Name,
		KeyPrefix: row.KeyPrefix,
		Role:      row.Role,
		CreatedBy: row.CreatedBy,
		CreatedAt: row.CreatedAt,
	}
	if row.LastUsedAt.Valid {
		t := row.LastUsedAt.Time
		k.LastUsedAt = &t
	}
	if row.ExpiresAt.Valid {
		t := row.ExpiresAt.Time
		k.ExpiresAt = &t
	}
	if row.RevokedAt.Valid {
		t := row.RevokedAt.Time
		k.RevokedAt = &t
	}
	return k
}
