package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/repository/db"
)

type PendingAdjustment struct {
	ID                 string
	TenantID           string
	CampaignResourceID string
	AdjustmentType     string
	CurrentValue       float64
	ProposedValue      float64
	Reason             string
	Status             string
	ExpiresAt          *time.Time
	ResolvedAt         *time.Time
	ResolvedBy         *string
	CreatedAt          time.Time
}

type CreatePendingAdjustmentParams struct {
	TenantID           string
	CampaignResourceID string
	AdjustmentType     string
	CurrentValue       float64
	ProposedValue      float64
	Reason             string
	ExpiresAt          *time.Time
}

type PendingAdjustmentRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewPendingAdjustmentRepository(pool *pgxpool.Pool) *PendingAdjustmentRepository {
	return &PendingAdjustmentRepository{pool: pool, queries: db.New(pool)}
}

func (r *PendingAdjustmentRepository) Create(ctx context.Context, params CreatePendingAdjustmentParams) (PendingAdjustment, error) {
	expiresAt := pgtype.Timestamptz{}
	if params.ExpiresAt != nil {
		expiresAt = pgtype.Timestamptz{Time: *params.ExpiresAt, Valid: true}
	}
	row, err := r.queries.InsertPendingAdjustment(ctx, db.InsertPendingAdjustmentParams{
		ID:                 domain.NewID(),
		TenantID:           params.TenantID,
		CampaignResourceID: params.CampaignResourceID,
		AdjustmentType:     params.AdjustmentType,
		CurrentValue:       params.CurrentValue,
		ProposedValue:      params.ProposedValue,
		Reason:             params.Reason,
		ExpiresAt:          expiresAt,
	})
	if err != nil {
		return PendingAdjustment{}, mapError(err)
	}
	return mapPendingAdjustment(row), nil
}

func (r *PendingAdjustmentRepository) ListByTenant(ctx context.Context, tenantID string, status *string) ([]PendingAdjustment, error) {
	if status != nil {
		rows, err := r.queries.ListPendingAdjustmentsByTenantAndStatus(ctx, db.ListPendingAdjustmentsByTenantAndStatusParams{
			TenantID: tenantID,
			Status:   *status,
		})
		if err != nil {
			return nil, mapError(err)
		}
		return mapPendingAdjustments(rows), nil
	}
	rows, err := r.queries.ListPendingAdjustmentsByTenant(ctx, tenantID)
	if err != nil {
		return nil, mapError(err)
	}
	return mapPendingAdjustments(rows), nil
}

func (r *PendingAdjustmentRepository) GetByID(ctx context.Context, id string) (PendingAdjustment, error) {
	row, err := r.queries.GetPendingAdjustmentByID(ctx, id)
	if err != nil {
		return PendingAdjustment{}, mapError(err)
	}
	return mapPendingAdjustment(row), nil
}

func (r *PendingAdjustmentRepository) Approve(ctx context.Context, id string, resolvedBy string) error {
	return mapError(r.queries.ApprovePendingAdjustment(ctx, db.ApprovePendingAdjustmentParams{
		ID:         id,
		ResolvedBy: &resolvedBy,
	}))
}

func (r *PendingAdjustmentRepository) Reject(ctx context.Context, id string, resolvedBy string) error {
	return mapError(r.queries.RejectPendingAdjustment(ctx, db.RejectPendingAdjustmentParams{
		ID:         id,
		ResolvedBy: &resolvedBy,
	}))
}

func (r *PendingAdjustmentRepository) ExpireOld(ctx context.Context) (int64, error) {
	n, err := r.queries.ExpireOldPendingAdjustments(ctx)
	return n, mapError(err)
}

// CreateApplied inserts a pending_adjustment record with status='applied' for auto-applied adjustments.
func (r *PendingAdjustmentRepository) CreateApplied(ctx context.Context, params CreatePendingAdjustmentParams) (PendingAdjustment, error) {
	expiresAt := pgtype.Timestamptz{}
	if params.ExpiresAt != nil {
		expiresAt = pgtype.Timestamptz{Time: *params.ExpiresAt, Valid: true}
	}
	const q = `
		INSERT INTO pending_adjustments (
			id, tenant_id, campaign_resource_id, adjustment_type,
			current_value, proposed_value, reason, status, expires_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, 'applied', $8)
		RETURNING id, tenant_id, campaign_resource_id, adjustment_type,
		          current_value, proposed_value, reason, status,
		          expires_at, resolved_at, resolved_by, created_at`
	row := r.pool.QueryRow(ctx, q,
		domain.NewID(),
		params.TenantID,
		params.CampaignResourceID,
		params.AdjustmentType,
		params.CurrentValue,
		params.ProposedValue,
		params.Reason,
		expiresAt,
	)
	var p db.PendingAdjustment
	err := row.Scan(
		&p.ID, &p.TenantID, &p.CampaignResourceID, &p.AdjustmentType,
		&p.CurrentValue, &p.ProposedValue, &p.Reason, &p.Status,
		&p.ExpiresAt, &p.ResolvedAt, &p.ResolvedBy, &p.CreatedAt,
	)
	if err != nil {
		return PendingAdjustment{}, mapError(err)
	}
	return mapPendingAdjustment(p), nil
}

func mapPendingAdjustment(row db.PendingAdjustment) PendingAdjustment {
	a := PendingAdjustment{
		ID:                 row.ID,
		TenantID:           row.TenantID,
		CampaignResourceID: row.CampaignResourceID,
		AdjustmentType:     row.AdjustmentType,
		CurrentValue:       row.CurrentValue,
		ProposedValue:      row.ProposedValue,
		Reason:             row.Reason,
		Status:             row.Status,
		ResolvedBy:         row.ResolvedBy,
		CreatedAt:          row.CreatedAt,
	}
	if row.ExpiresAt.Valid {
		t := row.ExpiresAt.Time
		a.ExpiresAt = &t
	}
	if row.ResolvedAt.Valid {
		t := row.ResolvedAt.Time
		a.ResolvedAt = &t
	}
	return a
}

func mapPendingAdjustments(rows []db.PendingAdjustment) []PendingAdjustment {
	out := make([]PendingAdjustment, len(rows))
	for i, row := range rows {
		out[i] = mapPendingAdjustment(row)
	}
	return out
}
