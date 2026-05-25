package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/repository/db"
)

type PostInsightRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewPostInsightRepository(pool *pgxpool.Pool) *PostInsightRepository {
	return &PostInsightRepository{pool: pool, queries: db.New(pool)}
}

type UpsertInsightParams struct {
	ID              string
	PublishResultID string
	PostID          string
	Platform        string
	Window          string
	Metrics         map[string]any
	RawResponse     map[string]any
}

func (r *PostInsightRepository) Upsert(ctx context.Context, p UpsertInsightParams) error {
	metricsJSON, _ := json.Marshal(p.Metrics)
	rawJSON, _ := json.Marshal(p.RawResponse)
	return mapError(r.queries.UpsertPostInsight(ctx, db.UpsertPostInsightParams{
		ID:              p.ID,
		PublishResultID: p.PublishResultID,
		PostID:          p.PostID,
		Platform:        p.Platform,
		InsightWindow:   p.Window,
		Metrics:         metricsJSON,
		RawResponse:     rawJSON,
	}))
}

func (r *PostInsightRepository) ListByPostID(ctx context.Context, postID string) ([]*domain.PostInsight, error) {
	rows, err := r.queries.ListPostInsightsByPostID(ctx, postID)
	if err != nil {
		return nil, mapError(err)
	}
	insights := make([]*domain.PostInsight, len(rows))
	for i, row := range rows {
		insights[i] = mapPostInsight(row)
	}
	return insights, nil
}

func (r *PostInsightRepository) ListPendingSync(ctx context.Context, window string, publishedAfter, publishedBefore time.Time) ([]*domain.PostPublishResult, error) {
	rows, err := r.queries.ListPendingInsightSync(ctx, db.ListPendingInsightSyncParams{
		InsightWindow: window,
		PublishedAt:   timePtrToTS(&publishedAfter),
		PublishedAt_2: timePtrToTS(&publishedBefore),
	})
	if err != nil {
		return nil, mapError(err)
	}
	results := make([]*domain.PostPublishResult, len(rows))
	for i, row := range rows {
		results[i] = &domain.PostPublishResult{
			ID:           row.ID,
			PostID:       row.PostID,
			TenantID:     row.PostTenantID,
			Platform:     row.Platform,
			Provider:     row.Provider,
			ExternalID:   row.ExternalID,
			Status:       row.Status,
			ErrorMessage: row.ErrorMessage,
			PublishedAt:  tsToTimePtr(row.PublishedAt),
			CreatedAt:    row.CreatedAt,
		}
	}
	return results, nil
}

func mapPostInsight(row db.PostInsight) *domain.PostInsight {
	var metrics map[string]any
	_ = json.Unmarshal(row.Metrics, &metrics)
	var rawResponse map[string]any
	_ = json.Unmarshal(row.RawResponse, &rawResponse)
	return &domain.PostInsight{
		ID:              row.ID,
		PublishResultID: row.PublishResultID,
		PostID:          row.PostID,
		Platform:        row.Platform,
		InsightWindow:   row.InsightWindow,
		Metrics:         metrics,
		RawResponse:     rawResponse,
		SyncedAt:        row.SyncedAt,
	}
}
