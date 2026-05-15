package repository

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/repository/db"
)

type TenantRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewTenantRepository(pool *pgxpool.Pool) *TenantRepository {
	return &TenantRepository{pool: pool, queries: db.New(pool)}
}

func (r *TenantRepository) List(ctx context.Context) ([]*domain.Tenant, error) {
	rows, err := r.queries.ListTenants(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	tenants := make([]*domain.Tenant, len(rows))
	for i, row := range rows {
		t, err := mapTenant(row)
		if err != nil {
			return nil, err
		}
		tenants[i] = t
	}
	return tenants, nil
}

func (r *TenantRepository) GetByID(ctx context.Context, id string) (*domain.Tenant, error) {
	row, err := r.queries.GetTenantByID(ctx, id)
	if err != nil {
		return nil, mapError(err)
	}
	return mapTenant(row)
}

func (r *TenantRepository) Create(ctx context.Context, t *domain.Tenant) error {
	hashJSON, _ := json.Marshal(t.Hashtags)
	adsJSON, _ := json.Marshal(t.AdsMonitoring)
	promptsJSON := marshalPrompts(t.ReportPrompts)
	return mapError(r.queries.CreateTenant(ctx, db.CreateTenantParams{
		ID:             t.ID,
		Name:           t.Name,
		Language:       t.Language,
		Niche:          t.Niche,
		Location:       t.Location,
		PrimaryPersona: t.PrimaryPersona,
		Tone:           t.Tone,
		Instructions:   t.Instructions,
		Hashtags:       hashJSON,
		AdsMonitoring:  adsJSON,
		ReportPrompts:  promptsJSON,
	}))
}

func (r *TenantRepository) Update(ctx context.Context, t *domain.Tenant) error {
	hashJSON, _ := json.Marshal(t.Hashtags)
	adsJSON, _ := json.Marshal(t.AdsMonitoring)
	promptsJSON := marshalPrompts(t.ReportPrompts)
	return mapError(r.queries.UpdateTenant(ctx, db.UpdateTenantParams{
		ID:             t.ID,
		Name:           t.Name,
		Language:       t.Language,
		Niche:          t.Niche,
		Location:       t.Location,
		PrimaryPersona: t.PrimaryPersona,
		Tone:           t.Tone,
		Instructions:   t.Instructions,
		Hashtags:       hashJSON,
		AdsMonitoring:  adsJSON,
		ReportPrompts:  promptsJSON,
	}))
}

func (r *TenantRepository) Delete(ctx context.Context, id string) error {
	return mapError(r.queries.DeleteTenant(ctx, id))
}

func marshalPrompts(p *domain.ReportPrompts) []byte {
	b, _ := json.Marshal(p)
	if len(b) == 0 || string(b) == "null" {
		return []byte("{}")
	}
	return b
}

func mapTenant(row db.Tenant) (*domain.Tenant, error) {
	var hashtags []string
	if err := json.Unmarshal(row.Hashtags, &hashtags); err != nil {
		hashtags = []string{}
	}
	var adsCfg *domain.AdsMonitoringConfig
	if len(row.AdsMonitoring) > 0 && string(row.AdsMonitoring) != "null" {
		adsCfg = &domain.AdsMonitoringConfig{}
		if err := json.Unmarshal(row.AdsMonitoring, adsCfg); err != nil {
			adsCfg = nil
		}
	}
	var prompts *domain.ReportPrompts
	if len(row.ReportPrompts) > 0 && string(row.ReportPrompts) != "null" && string(row.ReportPrompts) != "{}" {
		prompts = &domain.ReportPrompts{}
		if err := json.Unmarshal(row.ReportPrompts, prompts); err != nil {
			prompts = nil
		}
	}
	return &domain.Tenant{
		ID:             row.ID,
		Name:           row.Name,
		Language:       row.Language,
		Niche:          row.Niche,
		Location:       row.Location,
		PrimaryPersona: row.PrimaryPersona,
		Tone:           row.Tone,
		Instructions:   row.Instructions,
		Hashtags:       hashtags,
		AdsMonitoring:  adsCfg,
		ReportPrompts:  prompts,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}, nil
}
