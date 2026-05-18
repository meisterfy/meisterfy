package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/repository/db"
)

type LegalRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewLegalRepository(pool *pgxpool.Pool) *LegalRepository {
	return &LegalRepository{pool: pool, queries: db.New(pool)}
}

func (r *LegalRepository) GetLatestVersion(ctx context.Context) (*domain.LegalTermVersion, error) {
	row, err := r.queries.GetLatestLegalTermVersion(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	return mapLegalVersion(row)
}

func (r *LegalRepository) GetVersionByID(ctx context.Context, id string) (*domain.LegalTermVersion, error) {
	row, err := r.queries.GetLegalTermVersionByID(ctx, id)
	if err != nil {
		return nil, mapError(err)
	}
	return mapLegalVersion(row)
}

func (r *LegalRepository) ListVersions(ctx context.Context) ([]domain.LegalTermVersion, error) {
	rows, err := r.queries.ListLegalTermVersions(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	out := make([]domain.LegalTermVersion, 0, len(rows))
	for _, row := range rows {
		v, err := mapLegalVersion(row)
		if err != nil {
			return nil, err
		}
		out = append(out, *v)
	}
	return out, nil
}

func (r *LegalRepository) CreateVersion(ctx context.Context, v *domain.LegalTermVersion) error {
	raw, err := json.Marshal(v.Translations)
	if err != nil {
		return fmt.Errorf("marshal translations: %w", err)
	}
	maxRaw, err := r.queries.GetMaxLegalTermVersion(ctx)
	if err != nil {
		return mapError(err)
	}
	// sqlc returns interface{} for COALESCE with no column alias type info
	var maxVersion int32
	switch mv := maxRaw.(type) {
	case int64:
		maxVersion = int32(mv)
	case int32:
		maxVersion = mv
	}
	v.Version = int(maxVersion) + 1

	return mapError(r.queries.CreateLegalTermVersion(ctx, db.CreateLegalTermVersionParams{
		ID:             v.ID,
		Version:        int32(v.Version),
		FallbackLocale: v.FallbackLocale,
		Translations:   raw,
		EffectiveAt:    v.EffectiveAt,
		CreatedBy:      v.CreatedBy,
	}))
}

func (r *LegalRepository) UpdateVersion(ctx context.Context, v *domain.LegalTermVersion) error {
	raw, err := json.Marshal(v.Translations)
	if err != nil {
		return fmt.Errorf("marshal translations: %w", err)
	}
	return mapError(r.queries.UpdateLegalTermVersion(ctx, db.UpdateLegalTermVersionParams{
		ID:             v.ID,
		FallbackLocale: v.FallbackLocale,
		Translations:   raw,
		EffectiveAt:    v.EffectiveAt,
	}))
}

func (r *LegalRepository) HasUserAccepted(ctx context.Context, userID, versionID string) (bool, error) {
	accepted, err := r.queries.HasUserAcceptedLegalVersion(ctx, db.HasUserAcceptedLegalVersionParams{
		UserID:    userID,
		VersionID: versionID,
	})
	return accepted, mapError(err)
}

func (r *LegalRepository) RecordAcceptance(ctx context.Context, userID, versionID, locale, ip string) error {
	return mapError(r.queries.RecordLegalAcceptance(ctx, db.RecordLegalAcceptanceParams{
		UserID:     userID,
		VersionID:  versionID,
		LocaleSeen: &locale,
		Ip:         &ip,
	}))
}

func mapLegalVersion(row db.LegalTermVersion) (*domain.LegalTermVersion, error) {
	var translations map[string][]domain.TermBlock
	if err := json.Unmarshal(row.Translations, &translations); err != nil {
		return nil, fmt.Errorf("unmarshal translations: %w", err)
	}
	return &domain.LegalTermVersion{
		ID:             row.ID,
		Version:        int(row.Version),
		FallbackLocale: row.FallbackLocale,
		Translations:   translations,
		EffectiveAt:    row.EffectiveAt,
		CreatedBy:      row.CreatedBy,
		CreatedAt:      row.CreatedAt,
	}, nil
}
