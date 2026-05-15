package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mkt-maestro/mkt-maestro/internal/repository/db"
)

func uuidToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return uuid.UUID(u.Bytes).String()
}


type CampaignAIReport struct {
	ID              string
	TenantID        string
	CampaignID      string
	ReportType      string
	Content         string
	PeriodStart     *time.Time
	PeriodEnd       *time.Time
	GeneratedAt     time.Time
	GeneratedByName *string
	Model           *string
}

type CampaignReportRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewCampaignReportRepository(pool *pgxpool.Pool) *CampaignReportRepository {
	return &CampaignReportRepository{pool: pool, queries: db.New(pool)}
}

type SaveReportParams struct {
	TenantID    string
	CampaignID  string
	ReportType  string
	Content     string
	PeriodStart *time.Time
	PeriodEnd   *time.Time
	GeneratedBy *string // user ID string; nil = automated
	Model       *string
}

func (r *CampaignReportRepository) Save(ctx context.Context, p SaveReportParams) (*CampaignAIReport, error) {
	periodStart := pgtype.Date{}
	if p.PeriodStart != nil {
		periodStart = pgtype.Date{Time: *p.PeriodStart, Valid: true}
	}
	periodEnd := pgtype.Date{}
	if p.PeriodEnd != nil {
		periodEnd = pgtype.Date{Time: *p.PeriodEnd, Valid: true}
	}

	newID := uuid.New()
	row, err := r.queries.InsertCampaignAIReport(ctx, db.InsertCampaignAIReportParams{
		ID:          pgtype.UUID{Bytes: newID, Valid: true},
		TenantID:    p.TenantID,
		CampaignID:  p.CampaignID,
		ReportType:  p.ReportType,
		Content:     p.Content,
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
		GeneratedBy: p.GeneratedBy,
		Model:       p.Model,
	})
	if err != nil {
		return nil, mapError(err)
	}
	r2 := &CampaignAIReport{
		ID:          uuidToString(row.ID),
		TenantID:    row.TenantID,
		CampaignID:  row.CampaignID,
		ReportType:  row.ReportType,
		Content:     row.Content,
		GeneratedAt: row.GeneratedAt,
		Model:       row.Model,
	}
	if row.PeriodStart.Valid {
		t := row.PeriodStart.Time
		r2.PeriodStart = &t
	}
	if row.PeriodEnd.Valid {
		t := row.PeriodEnd.Time
		r2.PeriodEnd = &t
	}
	return r2, nil
}

func (r *CampaignReportRepository) List(ctx context.Context, tenantID, campaignID, reportType string, limit int) ([]CampaignAIReport, error) {
	rows, err := r.queries.ListCampaignAIReports(ctx, db.ListCampaignAIReportsParams{
		TenantID:   tenantID,
		CampaignID: campaignID,
		ReportType: reportType,
		Limit:      int32(limit),
	})
	if err != nil {
		return nil, mapError(err)
	}
	out := make([]CampaignAIReport, len(rows))
	for i, row := range rows {
		out[i] = *toReport(row)
	}
	return out, nil
}

func toReport(row db.ListCampaignAIReportsRow) *CampaignAIReport {
	r := &CampaignAIReport{
		ID:              uuidToString(row.ID),
		TenantID:        row.TenantID,
		CampaignID:      row.CampaignID,
		ReportType:      row.ReportType,
		Content:         row.Content,
		GeneratedAt:     row.GeneratedAt,
		GeneratedByName: row.GeneratedByName,
		Model:           row.Model,
	}
	if row.PeriodStart.Valid {
		t := row.PeriodStart.Time
		r.PeriodStart = &t
	}
	if row.PeriodEnd.Valid {
		t := row.PeriodEnd.Time
		r.PeriodEnd = &t
	}
	return r
}
