package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/middleware"
)

type PostRepo interface {
	List(ctx context.Context, tenantID string) ([]*domain.Post, error)
	ListByStatus(ctx context.Context, tenantID, status string) ([]*domain.Post, error)
	GetByID(ctx context.Context, id string) (*domain.Post, error)
	GetByIDAndTenant(ctx context.Context, id, tenantID string) (*domain.Post, error)
	Create(ctx context.Context, p *domain.Post) error
	Update(ctx context.Context, p *domain.Post) error
	UpdateStatus(ctx context.Context, id, tenantID, status string, publishedAt *time.Time) error
	Delete(ctx context.Context, id, tenantID string) error
}

type PostPublishResultRepo interface {
	ListByPostID(ctx context.Context, postID string) ([]*domain.PostPublishResult, error)
}

type AdminPostsHandler struct {
	postRepo          PostRepo
	publishResultRepo PostPublishResultRepo
	audit             AuditLogRepo
}

func NewAdminPostsHandler(postRepo PostRepo, publishResultRepo PostPublishResultRepo, audit AuditLogRepo) *AdminPostsHandler {
	return &AdminPostsHandler{postRepo: postRepo, publishResultRepo: publishResultRepo, audit: audit}
}

type postResponse struct {
	ID                  string               `json:"id"`
	TenantID            string               `json:"tenant_id"`
	Status              domain.PostStatus    `json:"status"`
	Title               *string              `json:"title"`
	Content             string               `json:"content"`
	Hashtags            []string             `json:"hashtags"`
	MediaType           *string              `json:"media_type"`
	MediaPath           *string              `json:"media_path"`
	Platforms           []string             `json:"platforms"`
	Workflow            *domain.PostWorkflow `json:"workflow"`
	ScheduledDate       *string              `json:"scheduled_date"`
	ScheduledTime       *string              `json:"scheduled_time"`
	ConnectorResourceID *string              `json:"connector_resource_id"`
	PublishedAt         *time.Time           `json:"published_at"`
	CreatedAt           time.Time            `json:"created_at"`
	UpdatedAt           time.Time            `json:"updated_at"`
}

func toPostResponse(p *domain.Post) postResponse {
	hashtags := p.Hashtags
	if hashtags == nil {
		hashtags = []string{}
	}
	platforms := p.Platforms
	if platforms == nil {
		platforms = []string{}
	}
	return postResponse{
		ID:                  p.ID,
		TenantID:            p.TenantID,
		Status:              p.Status,
		Title:               p.Title,
		Content:             p.Content,
		Hashtags:            hashtags,
		MediaType:           p.MediaType,
		MediaPath:           p.MediaPath,
		Platforms:           platforms,
		Workflow:            p.Workflow,
		ScheduledDate:       p.ScheduledDate,
		ScheduledTime:       p.ScheduledTime,
		ConnectorResourceID: p.ConnectorResourceID,
		PublishedAt:         p.PublishedAt,
		CreatedAt:           p.CreatedAt,
		UpdatedAt:           p.UpdatedAt,
	}
}

func (h *AdminPostsHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	status := r.URL.Query().Get("status")

	var posts []*domain.Post
	var err error
	if status != "" {
		posts, err = h.postRepo.ListByStatus(r.Context(), tenantID, status)
	} else {
		posts, err = h.postRepo.List(r.Context(), tenantID)
	}
	if err != nil {
		InternalError(w)
		return
	}

	data := make([]postResponse, len(posts))
	for i, p := range posts {
		data[i] = toPostResponse(p)
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

func (h *AdminPostsHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	p, err := h.postRepo.GetByIDAndTenant(r.Context(), chi.URLParam(r, "id"), tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"data": toPostResponse(p)})
}

func (h *AdminPostsHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	tenantID := chi.URLParam(r, "tenantId")

	var req struct {
		Title               *string              `json:"title"`
		Content             string               `json:"content"`
		Status              string               `json:"status"`
		Hashtags            []string             `json:"hashtags"`
		MediaType           *string              `json:"media_type"`
		MediaPath           *string              `json:"media_path"`
		Platforms           []string             `json:"platforms"`
		Workflow            *domain.PostWorkflow `json:"workflow"`
		ScheduledDate       *string              `json:"scheduled_date"`
		ScheduledTime       *string              `json:"scheduled_time"`
		ConnectorResourceID *string              `json:"connector_resource_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.Content == "" {
		UnprocessableEntity(w, "content is required")
		return
	}

	initialStatus := domain.PostStatus(req.Status)
	if initialStatus != domain.PostStatusScheduled {
		initialStatus = domain.PostStatusDraft
	}

	p := &domain.Post{
		ID:                  domain.NewID(),
		TenantID:            tenantID,
		Status:              initialStatus,
		Title:               req.Title,
		Content:             req.Content,
		Hashtags:            req.Hashtags,
		MediaType:           req.MediaType,
		MediaPath:           req.MediaPath,
		Platforms:           req.Platforms,
		Workflow:            req.Workflow,
		ScheduledDate:       req.ScheduledDate,
		ScheduledTime:       req.ScheduledTime,
		ConnectorResourceID: req.ConnectorResourceID,
	}
	if err := h.postRepo.Create(r.Context(), p); err != nil {
		InternalError(w)
		return
	}

	created, err := h.postRepo.GetByIDAndTenant(r.Context(), p.ID, tenantID)
	if err != nil {
		created = p
	}
	if claims != nil && h.audit != nil {
		title := ""
		if created.Title != nil {
			title = *created.Title
		}
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: tenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "post.created", EntityType: "post", EntityID: created.ID, EntityName: &title,
			After: toPostResponse(created), IP: auditIP(r),
		})
	}
	JSON(w, http.StatusCreated, map[string]any{"data": toPostResponse(created)})
}

func (h *AdminPostsHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	tenantID := chi.URLParam(r, "tenantId")
	id := chi.URLParam(r, "id")
	p, err := h.postRepo.GetByIDAndTenant(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	var req struct {
		Title               *string              `json:"title"`
		Content             *string              `json:"content"`
		Hashtags            []string             `json:"hashtags"`
		MediaType           *string              `json:"media_type"`
		MediaPath           *string              `json:"media_path"`
		Platforms           []string             `json:"platforms"`
		Workflow            *domain.PostWorkflow `json:"workflow"`
		ScheduledDate       *string              `json:"scheduled_date"`
		ScheduledTime       *string              `json:"scheduled_time"`
		ConnectorResourceID *string              `json:"connector_resource_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}

	if req.Title != nil {
		p.Title = req.Title
	}
	if req.Content != nil {
		p.Content = *req.Content
	}
	if req.Hashtags != nil {
		p.Hashtags = req.Hashtags
	}
	if req.MediaType != nil {
		p.MediaType = req.MediaType
	}
	if req.MediaPath != nil {
		p.MediaPath = req.MediaPath
	}
	if req.Platforms != nil {
		p.Platforms = req.Platforms
	}
	if req.Workflow != nil {
		p.Workflow = req.Workflow
	}
	if req.ScheduledDate != nil {
		p.ScheduledDate = req.ScheduledDate
	}
	if req.ScheduledTime != nil {
		p.ScheduledTime = req.ScheduledTime
	}
	if req.ConnectorResourceID != nil {
		p.ConnectorResourceID = req.ConnectorResourceID
	}

	if err := h.postRepo.Update(r.Context(), p); err != nil {
		InternalError(w)
		return
	}

	updated, err := h.postRepo.GetByIDAndTenant(r.Context(), p.ID, tenantID)
	if err != nil {
		updated = p
	}
	if claims != nil && h.audit != nil {
		title := ""
		if updated.Title != nil {
			title = *updated.Title
		}
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: tenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "post.updated", EntityType: "post", EntityID: updated.ID, EntityName: &title,
			After: toPostResponse(updated), IP: auditIP(r),
		})
	}
	JSON(w, http.StatusOK, map[string]any{"data": toPostResponse(updated)})
}

var transitionPermissions = map[domain.PostStatus]string{
	domain.PostStatusApproved:  "approve:post",
	domain.PostStatusScheduled: "schedule:post",
	domain.PostStatusPublished: "publish:post",
	domain.PostStatusDraft:     "review:post",
}

func (h *AdminPostsHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	tenantID := chi.URLParam(r, "tenantId")
	id := chi.URLParam(r, "id")

	p, err := h.postRepo.GetByIDAndTenant(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	var req struct {
		Status        string  `json:"status"`
		ScheduledDate *string `json:"scheduled_date"`
		ScheduledTime *string `json:"scheduled_time"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}

	next := domain.PostStatus(req.Status)
	if next == "" {
		UnprocessableEntity(w, "status is required")
		return
	}

	if !p.Status.CanTransitionTo(next) {
		UnprocessableEntity(w, "cannot transition from "+string(p.Status)+" to "+string(next))
		return
	}

	if perm, ok := transitionPermissions[next]; ok {
		if claims == nil || !claims.HasPermission(perm) {
			Forbidden(w)
			return
		}
	}

	var publishedAt *time.Time
	if next == domain.PostStatusPublished {
		t := time.Now()
		publishedAt = &t
	}
	if err := h.postRepo.UpdateStatus(r.Context(), id, tenantID, string(next), publishedAt); err != nil {
		InternalError(w)
		return
	}

	if req.ScheduledDate != nil || req.ScheduledTime != nil {
		p.ScheduledDate = req.ScheduledDate
		p.ScheduledTime = req.ScheduledTime
		if err := h.postRepo.Update(r.Context(), p); err != nil {
			InternalError(w)
			return
		}
	}

	updated, err := h.postRepo.GetByIDAndTenant(r.Context(), id, tenantID)
	if err != nil {
		InternalError(w)
		return
	}
	if claims != nil && h.audit != nil {
		title := ""
		if updated.Title != nil {
			title = *updated.Title
		}
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: tenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "post.status_changed", EntityType: "post", EntityID: updated.ID, EntityName: &title,
			After: map[string]any{"status": string(updated.Status)}, IP: auditIP(r),
		})
	}
	JSON(w, http.StatusOK, map[string]any{"data": toPostResponse(updated)})
}

func (h *AdminPostsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	tenantID := chi.URLParam(r, "tenantId")
	id := chi.URLParam(r, "id")
	before, _ := h.postRepo.GetByIDAndTenant(r.Context(), id, tenantID)
	if err := h.postRepo.Delete(r.Context(), id, tenantID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	if claims != nil && h.audit != nil && before != nil {
		title := ""
		if before.Title != nil {
			title = *before.Title
		}
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: tenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "post.deleted", EntityType: "post", EntityID: id, EntityName: &title,
			Before: toPostResponse(before), IP: auditIP(r),
		})
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminPostsHandler) GetPublishResults(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	id := chi.URLParam(r, "id")

	if _, err := h.postRepo.GetByIDAndTenant(r.Context(), id, tenantID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	results, err := h.publishResultRepo.ListByPostID(r.Context(), id)
	if err != nil {
		InternalError(w)
		return
	}

	type publishResultResponse struct {
		ID           string     `json:"id"`
		PostID       string     `json:"post_id"`
		Platform     string     `json:"platform"`
		Provider     string     `json:"provider"`
		ExternalID   *string    `json:"external_id"`
		Status       string     `json:"status"`
		ErrorMessage *string    `json:"error_message"`
		PublishedAt  *time.Time `json:"published_at"`
		CreatedAt    time.Time  `json:"created_at"`
	}

	data := make([]publishResultResponse, len(results))
	for i, res := range results {
		data[i] = publishResultResponse{
			ID:           res.ID,
			PostID:       res.PostID,
			Platform:     res.Platform,
			Provider:     res.Provider,
			ExternalID:   res.ExternalID,
			Status:       res.Status,
			ErrorMessage: res.ErrorMessage,
			PublishedAt:  res.PublishedAt,
			CreatedAt:    res.CreatedAt,
		}
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}
