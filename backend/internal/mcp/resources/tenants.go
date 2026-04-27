package resources

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/rush-maestro/rush-maestro/internal/domain"
	"github.com/rush-maestro/rush-maestro/internal/mcp"
)

// TenantResourceRepos groups the repository interfaces required by tenant resources.
type TenantResourceRepos struct {
	Tenants tenantResRepo
	Posts   postResRepo
	Reports reportResRepo
}

type tenantResRepo interface {
	List(ctx context.Context) ([]*domain.Tenant, error)
	GetByID(ctx context.Context, id string) (*domain.Tenant, error)
}

type postResRepo interface {
	List(ctx context.Context, tenantID string) ([]*domain.Post, error)
}

type reportResRepo interface {
	List(ctx context.Context, tenantID string) ([]*domain.Report, error)
	GetBySlug(ctx context.Context, tenantID, slug string) (*domain.Report, error)
}

// RegisterTenantResources registers 5 tenant resources on the MCP server.
func RegisterTenantResources(s *mcp.Server, repos TenantResourceRepos) {
	s.RegisterResource("tenants", "tenant://list", "application/json",
		func(ctx context.Context, _ string, _ map[string]string) (string, error) {
			tenants, err := repos.Tenants.List(ctx)
			if err != nil {
				return "", err
			}
			b, _ := json.MarshalIndent(tenants, "", "  ")
			return string(b), nil
		},
	)

	s.RegisterResourceTemplate("tenant-brand", "tenant://{id}/brand", "application/json",
		func(ctx context.Context, _ string, vars map[string]string) (string, error) {
			t, err := repos.Tenants.GetByID(ctx, vars["id"])
			if err != nil {
				return "", fmt.Errorf("tenant not found: %s", vars["id"])
			}
			b, _ := json.MarshalIndent(t, "", "  ")
			return string(b), nil
		},
	)

	s.RegisterResourceTemplate("tenant-posts", "tenant://{id}/posts", "application/json",
		func(ctx context.Context, _ string, vars map[string]string) (string, error) {
			posts, err := repos.Posts.List(ctx, vars["id"])
			if err != nil {
				return "", err
			}
			b, _ := json.MarshalIndent(posts, "", "  ")
			return string(b), nil
		},
	)

	s.RegisterResourceTemplate("tenant-reports", "tenant://{id}/reports", "application/json",
		func(ctx context.Context, _ string, vars map[string]string) (string, error) {
			reports, err := repos.Reports.List(ctx, vars["id"])
			if err != nil {
				return "", err
			}
			b, _ := json.MarshalIndent(reports, "", "  ")
			return string(b), nil
		},
	)

	s.RegisterResourceTemplate("tenant-report", "tenant://{id}/reports/{slug}", "text/markdown",
		func(ctx context.Context, _ string, vars map[string]string) (string, error) {
			r, err := repos.Reports.GetBySlug(ctx, vars["id"], vars["slug"])
			if err != nil {
				return "", fmt.Errorf("report not found: %s", vars["slug"])
			}
			return r.Content, nil
		},
	)
}
