package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rush-maestro/rush-maestro/internal/domain"
	"github.com/rush-maestro/rush-maestro/internal/repository"
)

type AdminAlertsHandler struct {
	alertRepo interface {
		ListOpen(ctx context.Context, tenantID string) ([]repository.AlertEvent, error)
		CountOpen(ctx context.Context, tenantID string) (int64, error)
		ListHistory(ctx context.Context, tenantID string, limit int) ([]repository.AlertEvent, error)
		Resolve(ctx context.Context, id string) error
		Ignore(ctx context.Context, id string) error
	}
}

func NewAdminAlertsHandler(
	alertRepo interface {
		ListOpen(ctx context.Context, tenantID string) ([]repository.AlertEvent, error)
		CountOpen(ctx context.Context, tenantID string) (int64, error)
		ListHistory(ctx context.Context, tenantID string, limit int) ([]repository.AlertEvent, error)
		Resolve(ctx context.Context, id string) error
		Ignore(ctx context.Context, id string) error
	},
) *AdminAlertsHandler {
	return &AdminAlertsHandler{alertRepo: alertRepo}
}

type alertResponse struct {
	ID           string          `json:"id"`
	TenantID     string          `json:"tenant_id"`
	Level        string          `json:"level"`
	Type         string          `json:"type"`
	CampaignID   *string         `json:"campaign_id"`
	CampaignName *string         `json:"campaign_name"`
	Message      string          `json:"message"`
	Details      json.RawMessage `json:"details"`
	ResolvedAt   *time.Time      `json:"resolved_at"`
	IgnoredAt    *time.Time      `json:"ignored_at"`
	CreatedAt    time.Time       `json:"created_at"`
}

func toAlertResponse(a repository.AlertEvent) alertResponse {
	return alertResponse{
		ID:           a.ID,
		TenantID:     a.TenantID,
		Level:        a.Level,
		Type:         a.Type,
		CampaignID:   a.CampaignID,
		CampaignName: a.CampaignName,
		Message:      a.Message,
		Details:      a.Details,
		ResolvedAt:   a.ResolvedAt,
		IgnoredAt:    a.IgnoredAt,
		CreatedAt:    a.CreatedAt,
	}
}

func (h *AdminAlertsHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	alerts, err := h.alertRepo.ListOpen(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}
	data := make([]alertResponse, len(alerts))
	for i, a := range alerts {
		data[i] = toAlertResponse(a)
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

func (h *AdminAlertsHandler) Count(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	count, err := h.alertRepo.CountOpen(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"count": count})
}

func (h *AdminAlertsHandler) History(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	alerts, err := h.alertRepo.ListHistory(r.Context(), tenantID, 100)
	if err != nil {
		InternalError(w)
		return
	}
	data := make([]alertResponse, len(alerts))
	for i, a := range alerts {
		data[i] = toAlertResponse(a)
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

func (h *AdminAlertsHandler) Resolve(w http.ResponseWriter, r *http.Request) {
	if err := h.alertRepo.Resolve(r.Context(), chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminAlertsHandler) Ignore(w http.ResponseWriter, r *http.Request) {
	if err := h.alertRepo.Ignore(r.Context(), chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
