package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rush-maestro/rush-maestro/internal/domain"
	"github.com/rush-maestro/rush-maestro/internal/repository"
)

type AdminCampaignsHandler struct {
	campaignRepo interface {
		List(ctx context.Context, tenantID string) ([]repository.Campaign, error)
		GetBySlug(ctx context.Context, tenantID, slug string) (*repository.Campaign, error)
		Upsert(ctx context.Context, id, tenantID, slug string, data json.RawMessage) error
		MarkDeployed(ctx context.Context, id string) error
		Delete(ctx context.Context, id string) error
	}
}

func NewAdminCampaignsHandler(
	campaignRepo interface {
		List(ctx context.Context, tenantID string) ([]repository.Campaign, error)
		GetBySlug(ctx context.Context, tenantID, slug string) (*repository.Campaign, error)
		Upsert(ctx context.Context, id, tenantID, slug string, data json.RawMessage) error
		MarkDeployed(ctx context.Context, id string) error
		Delete(ctx context.Context, id string) error
	},
) *AdminCampaignsHandler {
	return &AdminCampaignsHandler{campaignRepo: campaignRepo}
}

type campaignListItem struct {
	ID       string `json:"id"`
	TenantID string `json:"tenant_id"`
	Slug     string `json:"slug"`
}

type campaignDetailResponse struct {
	ID       string          `json:"id"`
	TenantID string          `json:"tenant_id"`
	Slug     string          `json:"slug"`
	Data     json.RawMessage `json:"data"`
}

func (h *AdminCampaignsHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	campaigns, err := h.campaignRepo.List(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}
	data := make([]campaignListItem, len(campaigns))
	for i, c := range campaigns {
		data[i] = campaignListItem{ID: c.ID, TenantID: c.TenantID, Slug: c.Slug}
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

func (h *AdminCampaignsHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	slug := chi.URLParam(r, "slug")

	c, err := h.campaignRepo.GetBySlug(r.Context(), tenantID, slug)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"data": campaignDetailResponse{
		ID:       c.ID,
		TenantID: c.TenantID,
		Slug:     c.Slug,
		Data:     c.Data,
	}})
}

func (h *AdminCampaignsHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	var req struct {
		Slug string          `json:"slug"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.Slug == "" {
		UnprocessableEntity(w, "slug is required")
		return
	}

	id := domain.NewID()
	if err := h.campaignRepo.Upsert(r.Context(), id, tenantID, req.Slug, req.Data); err != nil {
		InternalError(w)
		return
	}

	c, err := h.campaignRepo.GetBySlug(r.Context(), tenantID, req.Slug)
	if err != nil {
		InternalError(w)
		return
	}
	JSON(w, http.StatusCreated, map[string]any{"data": campaignDetailResponse{
		ID:       c.ID,
		TenantID: c.TenantID,
		Slug:     c.Slug,
		Data:     c.Data,
	}})
}

func (h *AdminCampaignsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.campaignRepo.Delete(r.Context(), chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminCampaignsHandler) Deploy(w http.ResponseWriter, r *http.Request) {
	if err := h.campaignRepo.MarkDeployed(r.Context(), chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
