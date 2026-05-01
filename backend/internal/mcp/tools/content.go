package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/rush-maestro/rush-maestro/internal/domain"
	"github.com/rush-maestro/rush-maestro/internal/mcp"
	"github.com/rush-maestro/rush-maestro/internal/repository"
)

// ContentRepos groups the repository interfaces required by content tools.
type ContentRepos struct {
	Tenants   tenantRepo
	Posts     postRepo
	Reports   reportRepo
	Campaigns campaignRepo
	Alerts    alertRepo
}

type tenantRepo interface {
	List(ctx context.Context) ([]*domain.Tenant, error)
	GetByID(ctx context.Context, id string) (*domain.Tenant, error)
	Create(ctx context.Context, t *domain.Tenant) error
	Update(ctx context.Context, t *domain.Tenant) error
}

type postRepo interface {
	List(ctx context.Context, tenantID string) ([]*domain.Post, error)
	ListByStatus(ctx context.Context, tenantID, status string) ([]*domain.Post, error)
	GetByID(ctx context.Context, id string) (*domain.Post, error)
	Create(ctx context.Context, p *domain.Post) error
	UpdateStatus(ctx context.Context, id, status string, publishedAt interface{}) error
	Delete(ctx context.Context, id string) error
}

type reportRepo interface {
	List(ctx context.Context, tenantID string) ([]*domain.Report, error)
	GetBySlug(ctx context.Context, tenantID, slug string) (*domain.Report, error)
	Create(ctx context.Context, r *domain.Report) error
}

type campaignRepo interface {
	List(ctx context.Context, tenantID string) ([]repository.Campaign, error)
	GetBySlug(ctx context.Context, tenantID, slug string) (*repository.Campaign, error)
}

type alertRepo interface {
	ListOpen(ctx context.Context, tenantID string) ([]repository.AlertEvent, error)
}

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(s)
	s = slugRe.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

// RegisterContentTools registers all 15 content tools on the MCP server.
func RegisterContentTools(s *mcp.Server, repos ContentRepos) {
	s.RegisterTool("list_tenants",
		"List all clients",
		map[string]any{"type": "object", "properties": map[string]any{}},
		func(ctx context.Context, _ json.RawMessage) mcp.ToolResult {
			tenants, err := repos.Tenants.List(ctx)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(tenants)
		},
	)

	s.RegisterTool("get_tenant",
		"Get brand config and persona for a client",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id": map[string]any{"type": "string", "description": `Tenant ID, e.g. "portico"`},
			},
			"required": []string{"id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				ID string `json:"id"`
			}
			json.Unmarshal(args, &p)
			t, err := repos.Tenants.GetByID(ctx, p.ID)
			if err != nil {
				return mcp.ErrResult(fmt.Sprintf(`Tenant "%s" not found`, p.ID))
			}
			return mcp.Ok(t)
		},
	)

	s.RegisterTool("create_tenant",
		"Create a new client",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":            map[string]any{"type": "string"},
				"name":          map[string]any{"type": "string"},
				"language":      map[string]any{"type": "string", "default": "pt_BR"},
				"niche":         map[string]any{"type": "string"},
				"location":      map[string]any{"type": "string"},
				"tone":          map[string]any{"type": "string"},
				"instructions":  map[string]any{"type": "string"},
				"hashtags":     map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			},
			"required": []string{"id", "name"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				ID           string   `json:"id"`
				Name         string   `json:"name"`
				Language     string   `json:"language"`
				Niche        *string  `json:"niche"`
				Location     *string  `json:"location"`
				Tone         *string  `json:"tone"`
				Instructions *string  `json:"instructions"`
				Hashtags     []string `json:"hashtags"`
			}
			json.Unmarshal(args, &p)
			if p.Language == "" {
				p.Language = "pt_BR"
			}
			t := &domain.Tenant{
				ID:           p.ID,
				Name:         p.Name,
				Language:     p.Language,
				Niche:        p.Niche,
				Location:     p.Location,
				Tone:         p.Tone,
				Instructions: p.Instructions,
				Hashtags:     p.Hashtags,
			}
			if err := repos.Tenants.Create(ctx, t); err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]string{"created": p.ID})
		},
	)

	s.RegisterTool("update_tenant",
		"Edit brand config for a client",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":            map[string]any{"type": "string"},
				"name":          map[string]any{"type": "string"},
				"language":      map[string]any{"type": "string"},
				"niche":         map[string]any{"type": "string"},
				"location":      map[string]any{"type": "string"},
				"tone":          map[string]any{"type": "string"},
				"instructions":  map[string]any{"type": "string"},
				"hashtags":     map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			},
			"required": []string{"id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				ID           string   `json:"id"`
				Name         *string  `json:"name"`
				Language     *string  `json:"language"`
				Niche        *string  `json:"niche"`
				Location     *string  `json:"location"`
				Tone         *string  `json:"tone"`
				Instructions *string  `json:"instructions"`
				Hashtags     []string `json:"hashtags"`
			}
			json.Unmarshal(args, &p)
			t, err := repos.Tenants.GetByID(ctx, p.ID)
			if err != nil {
				return mcp.ErrResult(fmt.Sprintf(`Tenant "%s" not found`, p.ID))
			}
			if p.Name != nil {
				t.Name = *p.Name
			}
			if p.Language != nil {
				t.Language = *p.Language
			}
			if p.Niche != nil {
				t.Niche = p.Niche
			}
			if p.Location != nil {
				t.Location = p.Location
			}
			if p.Tone != nil {
				t.Tone = p.Tone
			}
			if p.Instructions != nil {
				t.Instructions = p.Instructions
			}
			if p.Hashtags != nil {
				t.Hashtags = p.Hashtags
			}
			if err := repos.Tenants.Update(ctx, t); err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]string{"updated": p.ID})
		},
	)

	s.RegisterTool("list_posts",
		"List posts for a client (optionally filtered by status)",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id": map[string]any{"type": "string"},
				"status":    map[string]any{"type": "string", "enum": []string{"draft", "approved", "scheduled", "published"}},
			},
			"required": []string{"tenant_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string  `json:"tenant_id"`
				Status   *string `json:"status"`
			}
			json.Unmarshal(args, &p)
			var posts []*domain.Post
			var err error
			if p.Status != nil && *p.Status != "" {
				posts, err = repos.Posts.ListByStatus(ctx, p.TenantID, *p.Status)
			} else {
				posts, err = repos.Posts.List(ctx, p.TenantID)
			}
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(posts)
		},
	)

	s.RegisterTool("get_post",
		"Get an individual post with workflow",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id": map[string]any{"type": "string"},
			},
			"required": []string{"id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				ID string `json:"id"`
			}
			json.Unmarshal(args, &p)
			post, err := repos.Posts.GetByID(ctx, p.ID)
			if err != nil {
				return mcp.ErrResult(fmt.Sprintf(`Post "%s" not found`, p.ID))
			}
			return mcp.Ok(post)
		},
	)

	s.RegisterTool("create_post",
		"Create a new draft post",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id":  map[string]any{"type": "string"},
				"content":    map[string]any{"type": "string"},
				"title":      map[string]any{"type": "string"},
				"hashtags":   map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"media_type": map[string]any{"type": "string"},
			},
			"required": []string{"tenant_id", "content"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID  string   `json:"tenant_id"`
				Content   string   `json:"content"`
				Title     *string  `json:"title"`
				Hashtags  []string `json:"hashtags"`
				MediaType *string  `json:"media_type"`
			}
			json.Unmarshal(args, &p)
			var id string
			if p.Title != nil && *p.Title != "" {
				id = time.Now().Format("2006-01-02") + "_" + slugify(*p.Title)
			} else {
				id = domain.NewID()
			}
			post := &domain.Post{
				ID:        id,
				TenantID:  p.TenantID,
				Status:    domain.PostStatusDraft,
				Title:     p.Title,
				Content:   p.Content,
				Hashtags:  p.Hashtags,
				MediaType: p.MediaType,
			}
			if err := repos.Posts.Create(ctx, post); err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]string{"created": id})
		},
	)

	s.RegisterTool("update_post_status",
		"Transition a post status (draft → approved → scheduled → published)",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":     map[string]any{"type": "string"},
				"status": map[string]any{"type": "string", "enum": []string{"draft", "approved", "scheduled", "published"}},
			},
			"required": []string{"id", "status"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				ID     string `json:"id"`
				Status string `json:"status"`
			}
			json.Unmarshal(args, &p)
			var publishedAt *time.Time
			if p.Status == "published" {
				now := time.Now()
				publishedAt = &now
			}
			if err := repos.Posts.UpdateStatus(ctx, p.ID, p.Status, publishedAt); err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]string{"updated": p.ID, "status": p.Status})
		},
	)

	s.RegisterTool("delete_post",
		"Delete a post",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id": map[string]any{"type": "string"},
			},
			"required": []string{"id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				ID string `json:"id"`
			}
			json.Unmarshal(args, &p)
			if err := repos.Posts.Delete(ctx, p.ID); err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]string{"deleted": p.ID})
		},
	)

	s.RegisterTool("list_reports",
		"List reports for a client (without content)",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id": map[string]any{"type": "string"},
			},
			"required": []string{"tenant_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string `json:"tenant_id"`
			}
			json.Unmarshal(args, &p)
			reports, err := repos.Reports.List(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(reports)
		},
	)

	s.RegisterTool("get_report",
		"Get full markdown content of a report",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id": map[string]any{"type": "string"},
				"slug":      map[string]any{"type": "string"},
			},
			"required": []string{"tenant_id", "slug"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string `json:"tenant_id"`
				Slug     string `json:"slug"`
			}
			json.Unmarshal(args, &p)
			report, err := repos.Reports.GetBySlug(ctx, p.TenantID, p.Slug)
			if err != nil {
				return mcp.ErrResult(fmt.Sprintf(`Report "%s" not found`, p.Slug))
			}
			return mcp.Ok(report)
		},
	)

	s.RegisterTool("create_report",
		"Save a new report",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id": map[string]any{"type": "string"},
				"slug":      map[string]any{"type": "string"},
				"content":   map[string]any{"type": "string"},
				"title":     map[string]any{"type": "string"},
			},
			"required": []string{"tenant_id", "slug", "content"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string  `json:"tenant_id"`
				Slug     string  `json:"slug"`
				Content  string  `json:"content"`
				Title    *string `json:"title"`
			}
			json.Unmarshal(args, &p)
			report := &domain.Report{
				ID:       domain.NewID(),
				TenantID: p.TenantID,
				Slug:     p.Slug,
				Type:     domain.DetectReportType(p.Slug),
				Title:    p.Title,
				Content:  p.Content,
			}
			if err := repos.Reports.Create(ctx, report); err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(map[string]string{"created": p.Slug})
		},
	)

	s.RegisterTool("list_campaigns",
		"List local campaign drafts for a client (without full JSON data)",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id": map[string]any{"type": "string"},
			},
			"required": []string{"tenant_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string `json:"tenant_id"`
			}
			json.Unmarshal(args, &p)
			campaigns, err := repos.Campaigns.List(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			type summary struct {
				ID       string `json:"id"`
				TenantID string `json:"tenant_id"`
				Slug     string `json:"slug"`
			}
			result := make([]summary, len(campaigns))
			for i, c := range campaigns {
				result[i] = summary{ID: c.ID, TenantID: c.TenantID, Slug: c.Slug}
			}
			return mcp.Ok(result)
		},
	)

	s.RegisterTool("get_campaign",
		"Get full JSON of a local campaign draft",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id": map[string]any{"type": "string"},
				"slug":      map[string]any{"type": "string"},
			},
			"required": []string{"tenant_id", "slug"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string `json:"tenant_id"`
				Slug     string `json:"slug"`
			}
			json.Unmarshal(args, &p)
			campaign, err := repos.Campaigns.GetBySlug(ctx, p.TenantID, p.Slug)
			if err != nil {
				return mcp.ErrResult(fmt.Sprintf(`Campaign "%s" not found`, p.Slug))
			}
			return mcp.Ok(campaign)
		},
	)

	s.RegisterTool("check_alerts",
		"Get open monitoring alerts (WARN/CRITICAL) for a client",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id": map[string]any{"type": "string"},
			},
			"required": []string{"tenant_id"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string `json:"tenant_id"`
			}
			json.Unmarshal(args, &p)
			alerts, err := repos.Alerts.ListOpen(ctx, p.TenantID)
			if err != nil {
				return mcp.ErrResult(err.Error())
			}
			return mcp.Ok(alerts)
		},
	)
}
