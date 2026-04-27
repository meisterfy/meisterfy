package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rush-maestro/rush-maestro/internal/domain"
)

type AgentRun struct {
	ID         string
	TenantID   *string
	Agent      string
	Status     string
	StartedAt  time.Time
	FinishedAt *time.Time
	Summary    *string
	Error      *string
}

type AgentRunRepository struct {
	pool *pgxpool.Pool
}

func NewAgentRunRepository(pool *pgxpool.Pool) *AgentRunRepository {
	return &AgentRunRepository{pool: pool}
}

func (r *AgentRunRepository) ListRecent(ctx context.Context, tenantID string, limit int) ([]AgentRun, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, tenant_id, agent, status, started_at, finished_at, summary, error
		 FROM agent_runs
		 WHERE tenant_id = $1
		 ORDER BY started_at DESC
		 LIMIT $2`,
		tenantID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var runs []AgentRun
	for rows.Next() {
		var run AgentRun
		var finishedAt pgtype.Timestamptz
		if err := rows.Scan(&run.ID, &run.TenantID, &run.Agent, &run.Status,
			&run.StartedAt, &finishedAt, &run.Summary, &run.Error); err != nil {
			return nil, err
		}
		run.FinishedAt = tsToTimePtr(finishedAt)
		runs = append(runs, run)
	}
	return runs, rows.Err()
}

// Log inserts a completed agent run record in a single statement.
func (r *AgentRunRepository) Log(ctx context.Context, tenantID, agent, status, summary string) error {
	now := time.Now()
	id := domain.NewID()
	var tenantIDPtr *string
	if tenantID != "" {
		tenantIDPtr = &tenantID
	}
	_, err := r.pool.Exec(ctx,
		`INSERT INTO agent_runs (id, tenant_id, agent, status, started_at, finished_at, summary)
		 VALUES ($1, $2, $3, $4, $5, $5, $6)`,
		id, tenantIDPtr, agent, status, now, summary,
	)
	return err
}

func (r *AgentRunRepository) GetLast(ctx context.Context, tenantID, agent string) (*AgentRun, error) {
	var run AgentRun
	var finishedAt pgtype.Timestamptz
	err := r.pool.QueryRow(ctx,
		`SELECT id, tenant_id, agent, status, started_at, finished_at, summary, error
		 FROM agent_runs
		 WHERE tenant_id = $1 AND agent = $2
		 ORDER BY started_at DESC
		 LIMIT 1`,
		tenantID, agent,
	).Scan(&run.ID, &run.TenantID, &run.Agent, &run.Status,
		&run.StartedAt, &finishedAt, &run.Summary, &run.Error)
	if err != nil {
		return nil, mapError(err)
	}
	run.FinishedAt = tsToTimePtr(finishedAt)
	return &run, nil
}
