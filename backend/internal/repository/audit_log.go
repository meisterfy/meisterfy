package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/repository/db"
)

type AuditLogRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewAuditLogRepository(pool *pgxpool.Pool) *AuditLogRepository {
	return &AuditLogRepository{pool: pool, queries: db.New(pool)}
}

func (r *AuditLogRepository) Log(ctx context.Context, entry domain.AuditEntry) error {
	var beforeBytes, afterBytes []byte
	if entry.Before != nil {
		beforeBytes, _ = json.Marshal(entry.Before)
	}
	if entry.After != nil {
		afterBytes, _ = json.Marshal(entry.After)
	}
	return r.queries.InsertAuditLog(ctx, db.InsertAuditLogParams{
		ID:         domain.NewID(),
		TenantID:   entry.TenantID,
		UserID:     entry.UserID,
		UserName:   entry.UserName,
		Action:     entry.Action,
		EntityType: entry.EntityType,
		EntityID:   entry.EntityID,
		EntityName: entry.EntityName,
		Before:     beforeBytes,
		After:      afterBytes,
		Ip:         entry.IP,
	})
}

func (r *AuditLogRepository) List(ctx context.Context, filter domain.AuditLogFilter) ([]*domain.AuditEntry, int64, error) {
	limit := int32(filter.Limit) //nolint:gosec // clamped to ≤200 below
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	// Build WHERE clause dynamically — the sqlc-generated queries use ($n::text IS NULL OR ...)
	// which requires actual SQL NULL, not empty string. We build the query conditionally instead.
	where := "tenant_id = $1"
	args := []any{filter.TenantID}

	if filter.UserID != nil {
		args = append(args, *filter.UserID)
		where += fmt.Sprintf(" AND user_id = $%d", len(args))
	}
	if filter.EntityType != nil {
		args = append(args, *filter.EntityType)
		where += fmt.Sprintf(" AND entity_type = $%d", len(args))
	}
	if filter.EntityID != nil {
		args = append(args, *filter.EntityID)
		where += fmt.Sprintf(" AND entity_id = $%d", len(args))
	}

	var total int64
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM audit_log WHERE "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, int32(filter.Offset)) //nolint:gosec // offset is a page offset, bounded in practice
	listSQL := fmt.Sprintf(
		`SELECT id, tenant_id, user_id, user_name, action, entity_type, entity_id,
		        entity_name, before, after, ip, created_at
		 FROM audit_log WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, len(args)-1, len(args),
	)

	rows, err := r.pool.Query(ctx, listSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var entries []*domain.AuditEntry
	for rows.Next() {
		var row db.AuditLog
		if err := rows.Scan(
			&row.ID, &row.TenantID, &row.UserID, &row.UserName, &row.Action,
			&row.EntityType, &row.EntityID, &row.EntityName,
			&row.Before, &row.After, &row.Ip, &row.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		e := &domain.AuditEntry{
			ID:         row.ID,
			TenantID:   row.TenantID,
			UserID:     row.UserID,
			UserName:   row.UserName,
			Action:     row.Action,
			EntityType: row.EntityType,
			EntityID:   row.EntityID,
			EntityName: row.EntityName,
			IP:         row.Ip,
		}
		e.CreatedAt = &row.CreatedAt
		if len(row.Before) > 0 {
			var v any
			if json.Unmarshal(row.Before, &v) == nil {
				e.Before = v
			}
		}
		if len(row.After) > 0 {
			var v any
			if json.Unmarshal(row.After, &v) == nil {
				e.After = v
			}
		}
		entries = append(entries, e)
	}
	return entries, total, rows.Err()
}

// AsyncLog fires an audit entry in a detached goroutine so it never blocks or fails the request.
func (r *AuditLogRepository) AsyncLog(entry domain.AuditEntry) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := r.Log(ctx, entry); err != nil {
			slog.Warn("audit log write failed", "action", entry.Action, "entity", entry.EntityID, "err", err)
		}
	}()
}
