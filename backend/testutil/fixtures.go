package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
)

// MustCreateTenant creates a tenant with the given id/name or fails the test.
func MustCreateTenant(ctx context.Context, t testing.TB, pool *pgxpool.Pool, id, name string) {
	t.Helper()
	_, err := pool.Exec(ctx,
		`INSERT INTO tenants (id, name, language, created_at, updated_at)
		 VALUES ($1, $2, 'pt_BR', NOW(), NOW())
		 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
		id, name,
	)
	if err != nil {
		t.Fatalf("create tenant: %v", err)
	}
}

// MustCreatePost inserts a minimal post row for testing.
func MustCreatePost(ctx context.Context, t testing.TB, pool *pgxpool.Pool, id, tenantID, content string, status string) {
	t.Helper()
	_, err := pool.Exec(ctx,
		`INSERT INTO posts (id, tenant_id, status, content, hashtags, platforms, workflow, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, '[]', '[]', '{}', NOW(), NOW())`,
		id, tenantID, status, content,
	)
	if err != nil {
		t.Fatalf("create post: %v", err)
	}
}

// MustCreateCampaign inserts a campaign for testing.
func MustCreateCampaign(ctx context.Context, t testing.TB, pool *pgxpool.Pool, id, tenantID, slug string, data []byte) {
	t.Helper()
	if data == nil {
		data = []byte("{}")
	}
	_, err := pool.Exec(ctx,
		`INSERT INTO campaigns (id, tenant_id, slug, data, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
		id, tenantID, slug, data,
	)
	if err != nil {
		t.Fatalf("create campaign: %v", err)
	}
}

// MustCreateAlert inserts an alert for testing.
func MustCreateAlert(ctx context.Context, t testing.TB, pool *pgxpool.Pool, id, tenantID, level, alertType, message string) {
	t.Helper()
	_, err := pool.Exec(ctx,
		`INSERT INTO alert_events (id, tenant_id, level, type, message, details, created_at)
		 VALUES ($1, $2, $3, $4, $5, '{}', NOW())`,
		id, tenantID, level, alertType, message,
	)
	if err != nil {
		t.Fatalf("create alert: %v", err)
	}
}

// MustCreateReport inserts a report for testing.
func MustCreateReport(ctx context.Context, t testing.TB, pool *pgxpool.Pool, id, tenantID, slug, reportType, title, content string) {
	t.Helper()
	_, err := pool.Exec(ctx,
		`INSERT INTO reports (id, tenant_id, slug, type, title, content, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
		id, tenantID, slug, reportType, title, content,
	)
	if err != nil {
		t.Fatalf("create report: %v", err)
	}
}

// MustCreateIntegration inserts an integration for testing.
func MustCreateIntegration(ctx context.Context, t testing.TB, pool *pgxpool.Pool, id, name, provider, group, status string) {
	t.Helper()
	_, err := pool.Exec(ctx,
		`INSERT INTO integrations (id, name, provider, "group", status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
		id, name, provider, group, status,
	)
	if err != nil {
		t.Fatalf("create integration: %v", err)
	}
}

// MustLinkIntegrationTenant links an integration to a tenant.
func MustLinkIntegrationTenant(ctx context.Context, t testing.TB, pool *pgxpool.Pool, integrationID, tenantID string) {
	t.Helper()
	_, err := pool.Exec(ctx,
		`INSERT INTO integration_tenants (integration_id, tenant_id)
		 VALUES ($1, $2)
		 ON CONFLICT DO NOTHING`,
		integrationID, tenantID,
	)
	if err != nil {
		t.Fatalf("link integration tenant: %v", err)
	}
}

// MustCreateAgentRun inserts an agent run for testing.
func MustCreateAgentRun(ctx context.Context, t testing.TB, pool *pgxpool.Pool, id, tenantID, agent, status string, startedAt time.Time) {
	t.Helper()
	_, err := pool.Exec(ctx,
		`INSERT INTO agent_runs (id, tenant_id, agent, status, started_at, finished_at, summary)
		 VALUES ($1, $2, $3, $4, $5, $5, 'test summary')`,
		id, tenantID, agent, status, startedAt,
	)
	if err != nil {
		t.Fatalf("create agent run: %v", err)
	}
}

// Ptr returns a pointer to v.
func Ptr[T any](v T) *T {
	return &v
}

// NewTestTenant returns a minimally populated Tenant for use in repository tests.
func NewTestTenant(id, name string) *domain.Tenant {
	return &domain.Tenant{
		ID:       id,
		Name:     name,
		Language: "pt_BR",
	}
}

// NewTestPost returns a minimally populated Post for use in repository tests.
func NewTestPost(id, tenantID, content string) *domain.Post {
	now := time.Now()
	return &domain.Post{
		ID:        id,
		TenantID:  tenantID,
		Status:    domain.PostStatusDraft,
		Content:   content,
		Hashtags:  []string{},
		Platforms: []string{},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// NewTestIntegration returns a minimally populated Integration for use in repository tests.
func NewTestIntegration(id, name string, provider domain.IntegrationProvider) *domain.Integration {
	return &domain.Integration{
		ID:       id,
		Name:     name,
		Provider: provider,
		Group:    domain.GroupAds,
		Status:   domain.StatusPending,
	}
}

// MustCreateUser creates a user row for testing.
func MustCreateUser(ctx context.Context, t testing.TB, pool *pgxpool.Pool, id, email string) {
	t.Helper()
	_, err := pool.Exec(ctx,
		`INSERT INTO users (id, name, email, password_hash, locale, timezone, is_active)
		 VALUES ($1, $2, $3, 'x', 'pt_BR', 'UTC', true)`,
		id, "User "+id, email,
	)
	if err != nil {
		t.Fatalf("create user %s: %v", id, err)
	}
}

// MustCreateRole creates a role row for testing.
func MustCreateRole(ctx context.Context, t testing.TB, pool *pgxpool.Pool, id, name string, tenantID *string) {
	t.Helper()
	_, err := pool.Exec(ctx,
		`INSERT INTO roles (id, name, tenant_id) VALUES ($1, $2, $3)`,
		id, name, tenantID,
	)
	if err != nil {
		t.Fatalf("create role %s: %v", id, err)
	}
}
