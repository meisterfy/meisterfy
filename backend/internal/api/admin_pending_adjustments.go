package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/middleware"
	"github.com/mkt-maestro/mkt-maestro/internal/repository"
)

type PendingAdjustmentRepo interface {
	ListByTenant(ctx context.Context, tenantID string, status *string) ([]repository.PendingAdjustment, error)
	GetByID(ctx context.Context, id string) (repository.PendingAdjustment, error)
	Approve(ctx context.Context, id string, resolvedBy string) error
	Reject(ctx context.Context, id string, resolvedBy string) error
}

type AdminPendingAdjustmentsHandler struct {
	repo PendingAdjustmentRepo
}

func NewAdminPendingAdjustmentsHandler(repo PendingAdjustmentRepo) *AdminPendingAdjustmentsHandler {
	return &AdminPendingAdjustmentsHandler{repo: repo}
}

// GET /admin/tenants/{tenantId}/pending-adjustments
func (h *AdminPendingAdjustmentsHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	var status *string
	if s := r.URL.Query().Get("status"); s != "" {
		status = &s
	}

	adjustments, err := h.repo.ListByTenant(r.Context(), tenantID, status)
	if err != nil {
		InternalError(w)
		return
	}

	data := make([]map[string]any, len(adjustments))
	for i, a := range adjustments {
		data[i] = serializePendingAdjustment(a)
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

// POST /admin/tenants/{tenantId}/pending-adjustments/{id}/approve
func (h *AdminPendingAdjustmentsHandler) Approve(w http.ResponseWriter, r *http.Request) {
	h.resolve(w, r, true)
}

// POST /admin/tenants/{tenantId}/pending-adjustments/{id}/reject
func (h *AdminPendingAdjustmentsHandler) Reject(w http.ResponseWriter, r *http.Request) {
	h.resolve(w, r, false)
}

func (h *AdminPendingAdjustmentsHandler) resolve(w http.ResponseWriter, r *http.Request, approve bool) {
	tenantID := chi.URLParam(r, "tenantId")
	id := chi.URLParam(r, "id")

	claims := middleware.UserClaimsFromContext(r.Context())
	if claims == nil {
		Unauthorized(w)
		return
	}

	adj, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	if adj.TenantID != tenantID {
		NotFound(w)
		return
	}

	if adj.Status != "pending" {
		Error(w, http.StatusConflict, "adjustment already resolved")
		return
	}

	if approve {
		err = h.repo.Approve(r.Context(), id, claims.UserID)
	} else {
		err = h.repo.Reject(r.Context(), id, claims.UserID)
	}
	if err != nil {
		InternalError(w)
		return
	}

	JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func serializePendingAdjustment(a repository.PendingAdjustment) map[string]any {
	m := map[string]any{
		"id":                   a.ID,
		"tenant_id":            a.TenantID,
		"campaign_resource_id": a.CampaignResourceID,
		"adjustment_type":      a.AdjustmentType,
		"current_value":        a.CurrentValue,
		"proposed_value":       a.ProposedValue,
		"reason":               a.Reason,
		"status":               a.Status,
		"expires_at":           a.ExpiresAt,
		"resolved_at":          a.ResolvedAt,
		"resolved_by":          a.ResolvedBy,
		"created_at":           a.CreatedAt,
	}
	return m
}
