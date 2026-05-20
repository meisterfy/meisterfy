package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/repository/db"
)

type PostPublishResultRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewPostPublishResultRepository(pool *pgxpool.Pool) *PostPublishResultRepository {
	return &PostPublishResultRepository{pool: pool, queries: db.New(pool)}
}

type CreatePublishResultParams struct {
	ID           string
	PostID       string
	Platform     string
	Provider     string
	ExternalID   *string
	Status       string
	ErrorMessage *string
	PublishedAt  *time.Time
}

func (r *PostPublishResultRepository) Create(ctx context.Context, p CreatePublishResultParams) error {
	return mapError(r.queries.CreatePostPublishResult(ctx, db.CreatePostPublishResultParams{
		ID:           p.ID,
		PostID:       p.PostID,
		Platform:     p.Platform,
		Provider:     p.Provider,
		ExternalID:   p.ExternalID,
		Status:       p.Status,
		ErrorMessage: p.ErrorMessage,
		PublishedAt:  timePtrToTS(p.PublishedAt),
	}))
}

func (r *PostPublishResultRepository) ListByPostID(ctx context.Context, postID string) ([]*domain.PostPublishResult, error) {
	rows, err := r.queries.ListPostPublishResultsByPostID(ctx, postID)
	if err != nil {
		return nil, mapError(err)
	}
	results := make([]*domain.PostPublishResult, len(rows))
	for i, row := range rows {
		results[i] = mapPublishResult(row)
	}
	return results, nil
}

func (r *PostPublishResultRepository) ExistsForPost(ctx context.Context, postID string) (bool, error) {
	exists, err := r.queries.ExistsPostPublishResultForPost(ctx, postID)
	return exists, mapError(err)
}

func mapPublishResult(row db.PostPublishResult) *domain.PostPublishResult {
	return &domain.PostPublishResult{
		ID:           row.ID,
		PostID:       row.PostID,
		Platform:     row.Platform,
		Provider:     row.Provider,
		ExternalID:   row.ExternalID,
		Status:       row.Status,
		ErrorMessage: row.ErrorMessage,
		PublishedAt:  tsToTimePtr(row.PublishedAt),
		CreatedAt:    row.CreatedAt,
	}
}
