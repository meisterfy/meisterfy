package api

import (
	"context"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/meisterfy/meisterfy/internal/domain"
)

type AuditLogRepo interface {
	Log(ctx context.Context, entry domain.AuditEntry) error
	List(ctx context.Context, filter domain.AuditLogFilter) ([]*domain.AuditEntry, int64, error)
	AsyncLog(entry domain.AuditEntry)
}

type AdminAuditLogHandler struct {
	repo AuditLogRepo
}

func NewAdminAuditLogHandler(repo AuditLogRepo) *AdminAuditLogHandler {
	return &AdminAuditLogHandler{repo: repo}
}

// GET /admin/tenants/{tenantId}/audit-log
func (h *AdminAuditLogHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	filter := domain.AuditLogFilter{
		TenantID: tenantID,
		Limit:    50,
	}

	if v := r.URL.Query().Get("user_id"); v != "" {
		filter.UserID = &v
	}
	if v := r.URL.Query().Get("entity_type"); v != "" {
		filter.EntityType = &v
	}
	if v := r.URL.Query().Get("entity_id"); v != "" {
		filter.EntityID = &v
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
			filter.Limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			filter.Offset = n
		}
	}

	entries, total, err := h.repo.List(r.Context(), filter)
	if err != nil {
		InternalError(w)
		return
	}

	data := make([]map[string]any, len(entries))
	for i, e := range entries {
		row := map[string]any{
			"id":          e.ID,
			"user_id":     e.UserID,
			"user_name":   e.UserName,
			"action":      e.Action,
			"entity_type": e.EntityType,
			"entity_id":   e.EntityID,
			"entity_name": e.EntityName,
			"before":      e.Before,
			"after":       e.After,
			"created_at":  e.CreatedAt,
		}
		data[i] = row
	}

	JSON(w, http.StatusOK, map[string]any{"data": data, "total": total})
}
