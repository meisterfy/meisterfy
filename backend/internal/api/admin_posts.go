package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rush-maestro/rush-maestro/internal/domain"
	"github.com/rush-maestro/rush-maestro/internal/middleware"
)

type AdminPostsHandler struct {
	postRepo interface {
		List(ctx context.Context, tenantID string) ([]*domain.Post, error)
		ListByStatus(ctx context.Context, tenantID, status string) ([]*domain.Post, error)
		GetByID(ctx context.Context, id string) (*domain.Post, error)
		Create(ctx context.Context, p *domain.Post) error
		Update(ctx context.Context, p *domain.Post) error
		UpdateStatus(ctx context.Context, id, status string, publishedAt interface{}) error
		Delete(ctx context.Context, id string) error
	}
}

func NewAdminPostsHandler(
	postRepo interface {
		List(ctx context.Context, tenantID string) ([]*domain.Post, error)
		ListByStatus(ctx context.Context, tenantID, status string) ([]*domain.Post, error)
		GetByID(ctx context.Context, id string) (*domain.Post, error)
		Create(ctx context.Context, p *domain.Post) error
		Update(ctx context.Context, p *domain.Post) error
		UpdateStatus(ctx context.Context, id, status string, publishedAt interface{}) error
		Delete(ctx context.Context, id string) error
	},
) *AdminPostsHandler {
	return &AdminPostsHandler{postRepo: postRepo}
}

type postResponse struct {
	ID            string               `json:"id"`
	TenantID      string               `json:"tenant_id"`
	Status        domain.PostStatus    `json:"status"`
	Title         *string              `json:"title"`
	Content       string               `json:"content"`
	Hashtags      []string             `json:"hashtags"`
	MediaType     *string              `json:"media_type"`
	MediaPath     *string              `json:"media_path"`
	Platforms     []string             `json:"platforms"`
	Workflow      *domain.PostWorkflow `json:"workflow"`
	ScheduledDate *string              `json:"scheduled_date"`
	ScheduledTime *string              `json:"scheduled_time"`
	PublishedAt   *time.Time           `json:"published_at"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`
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
		ID:            p.ID,
		TenantID:      p.TenantID,
		Status:        p.Status,
		Title:         p.Title,
		Content:       p.Content,
		Hashtags:      hashtags,
		MediaType:     p.MediaType,
		MediaPath:     p.MediaPath,
		Platforms:     platforms,
		Workflow:      p.Workflow,
		ScheduledDate: p.ScheduledDate,
		ScheduledTime: p.ScheduledTime,
		PublishedAt:   p.PublishedAt,
		CreatedAt:     p.CreatedAt,
		UpdatedAt:     p.UpdatedAt,
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
	p, err := h.postRepo.GetByID(r.Context(), chi.URLParam(r, "id"))
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
	tenantID := chi.URLParam(r, "tenantId")

	var req struct {
		Title         *string              `json:"title"`
		Content       string               `json:"content"`
		Hashtags      []string             `json:"hashtags"`
		MediaType     *string              `json:"media_type"`
		MediaPath     *string              `json:"media_path"`
		Platforms     []string             `json:"platforms"`
		Workflow      *domain.PostWorkflow `json:"workflow"`
		ScheduledDate *string              `json:"scheduled_date"`
		ScheduledTime *string              `json:"scheduled_time"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.Content == "" {
		UnprocessableEntity(w, "content is required")
		return
	}

	p := &domain.Post{
		ID:            domain.NewID(),
		TenantID:      tenantID,
		Status:        domain.PostStatusDraft,
		Title:         req.Title,
		Content:       req.Content,
		Hashtags:      req.Hashtags,
		MediaType:     req.MediaType,
		MediaPath:     req.MediaPath,
		Platforms:     req.Platforms,
		Workflow:      req.Workflow,
		ScheduledDate: req.ScheduledDate,
		ScheduledTime: req.ScheduledTime,
	}
	if err := h.postRepo.Create(r.Context(), p); err != nil {
		InternalError(w)
		return
	}

	created, err := h.postRepo.GetByID(r.Context(), p.ID)
	if err != nil {
		created = p
	}
	JSON(w, http.StatusCreated, map[string]any{"data": toPostResponse(created)})
}

func (h *AdminPostsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	p, err := h.postRepo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	var req struct {
		Title         *string              `json:"title"`
		Content       *string              `json:"content"`
		Hashtags      []string             `json:"hashtags"`
		MediaType     *string              `json:"media_type"`
		MediaPath     *string              `json:"media_path"`
		Platforms     []string             `json:"platforms"`
		Workflow      *domain.PostWorkflow `json:"workflow"`
		ScheduledDate *string              `json:"scheduled_date"`
		ScheduledTime *string              `json:"scheduled_time"`
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

	if err := h.postRepo.Update(r.Context(), p); err != nil {
		InternalError(w)
		return
	}

	updated, err := h.postRepo.GetByID(r.Context(), p.ID)
	if err != nil {
		updated = p
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
	id := chi.URLParam(r, "id")

	p, err := h.postRepo.GetByID(r.Context(), id)
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

	if err := h.postRepo.UpdateStatus(r.Context(), id, string(next), nil); err != nil {
		InternalError(w)
		return
	}

	if req.ScheduledDate != nil || req.ScheduledTime != nil {
		p.ScheduledDate = req.ScheduledDate
		p.ScheduledTime = req.ScheduledTime
		_ = h.postRepo.Update(r.Context(), p)
	}

	updated, err := h.postRepo.GetByID(r.Context(), id)
	if err != nil {
		InternalError(w)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"data": toPostResponse(updated)})
}

func (h *AdminPostsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.postRepo.Delete(r.Context(), chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
