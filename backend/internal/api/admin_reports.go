package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rush-maestro/rush-maestro/internal/domain"
)

type AdminReportsHandler struct {
	reportRepo interface {
		List(ctx context.Context, tenantID string) ([]*domain.Report, error)
		GetBySlug(ctx context.Context, tenantID, slug string) (*domain.Report, error)
		GetByID(ctx context.Context, id string) (*domain.Report, error)
		Create(ctx context.Context, rep *domain.Report) error
		Delete(ctx context.Context, id string) error
	}
}

func NewAdminReportsHandler(
	reportRepo interface {
		List(ctx context.Context, tenantID string) ([]*domain.Report, error)
		GetBySlug(ctx context.Context, tenantID, slug string) (*domain.Report, error)
		GetByID(ctx context.Context, id string) (*domain.Report, error)
		Create(ctx context.Context, rep *domain.Report) error
		Delete(ctx context.Context, id string) error
	},
) *AdminReportsHandler {
	return &AdminReportsHandler{reportRepo: reportRepo}
}

type reportListItem struct {
	ID        string            `json:"id"`
	TenantID  string            `json:"tenant_id"`
	Slug      string            `json:"slug"`
	Type      domain.ReportType `json:"type"`
	Title     *string           `json:"title"`
	CreatedAt time.Time         `json:"created_at"`
}

type reportDetailResponse struct {
	ID        string            `json:"id"`
	TenantID  string            `json:"tenant_id"`
	Slug      string            `json:"slug"`
	Type      domain.ReportType `json:"type"`
	Title     *string           `json:"title"`
	Content   string            `json:"content"`
	CreatedAt time.Time         `json:"created_at"`
}

func (h *AdminReportsHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	reports, err := h.reportRepo.List(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}
	data := make([]reportListItem, len(reports))
	for i, rep := range reports {
		data[i] = reportListItem{
			ID:        rep.ID,
			TenantID:  rep.TenantID,
			Slug:      rep.Slug,
			Type:      rep.Type,
			Title:     rep.Title,
			CreatedAt: rep.CreatedAt,
		}
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

func (h *AdminReportsHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	slug := chi.URLParam(r, "slug")

	rep, err := h.reportRepo.GetBySlug(r.Context(), tenantID, slug)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"data": reportDetailResponse{
		ID:        rep.ID,
		TenantID:  rep.TenantID,
		Slug:      rep.Slug,
		Type:      rep.Type,
		Title:     rep.Title,
		Content:   rep.Content,
		CreatedAt: rep.CreatedAt,
	}})
}

func (h *AdminReportsHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	var req struct {
		Slug    string             `json:"slug"`
		Type    *domain.ReportType `json:"type"`
		Title   *string            `json:"title"`
		Content string             `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.Slug == "" || req.Content == "" {
		UnprocessableEntity(w, "slug and content are required")
		return
	}

	reportType := domain.DetectReportType(req.Slug)
	if req.Type != nil {
		reportType = *req.Type
	}

	rep := &domain.Report{
		ID:       domain.NewID(),
		TenantID: tenantID,
		Slug:     req.Slug,
		Type:     reportType,
		Title:    req.Title,
		Content:  req.Content,
	}
	if err := h.reportRepo.Create(r.Context(), rep); err != nil {
		if errors.Is(err, domain.ErrConflict) {
			Error(w, http.StatusConflict, "a report with this slug already exists for this tenant")
			return
		}
		InternalError(w)
		return
	}

	created, err := h.reportRepo.GetBySlug(r.Context(), tenantID, rep.Slug)
	if err != nil {
		created = rep
	}
	JSON(w, http.StatusCreated, map[string]any{"data": reportDetailResponse{
		ID:        created.ID,
		TenantID:  created.TenantID,
		Slug:      created.Slug,
		Type:      created.Type,
		Title:     created.Title,
		Content:   created.Content,
		CreatedAt: created.CreatedAt,
	}})
}

func (h *AdminReportsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.reportRepo.Delete(r.Context(), chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
