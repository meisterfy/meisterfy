package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/middleware"
	"github.com/mkt-maestro/mkt-maestro/internal/repository"
)

var validMcpKeyRoles = map[string]bool{
	"readonly": true,
	"editor":   true,
	"admin":    true,
}

type McpApiKeyRepo interface {
	Create(ctx context.Context, tenantID, createdBy, name, role string, expiresAt *time.Time) (repository.McpApiKey, string, error)
	GetByHash(ctx context.Context, keyHash string) (repository.McpApiKey, error)
	ListByTenant(ctx context.Context, tenantID string) ([]repository.McpApiKey, error)
	Revoke(ctx context.Context, id, tenantID string) error
	UpdateLastUsed(ctx context.Context, id string) error
}

type AdminMcpKeysHandler struct {
	repo McpApiKeyRepo
}

func NewAdminMcpKeysHandler(repo McpApiKeyRepo) *AdminMcpKeysHandler {
	return &AdminMcpKeysHandler{repo: repo}
}

// GET /admin/tenants/{tenantId}/mcp-keys
func (h *AdminMcpKeysHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	keys, err := h.repo.ListByTenant(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}

	data := make([]map[string]any, len(keys))
	for i, k := range keys {
		data[i] = serializeMcpApiKey(k)
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

// POST /admin/tenants/{tenantId}/mcp-keys
func (h *AdminMcpKeysHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	claims := middleware.UserClaimsFromContext(r.Context())
	if claims == nil {
		Unauthorized(w)
		return
	}

	var body struct {
		Name      string     `json:"name"`
		Role      string     `json:"role"`
		ExpiresAt *time.Time `json:"expires_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if body.Name == "" {
		Error(w, http.StatusBadRequest, "name is required")
		return
	}
	if !validMcpKeyRoles[body.Role] {
		Error(w, http.StatusBadRequest, "role must be one of: readonly, editor, admin")
		return
	}

	key, fullKey, err := h.repo.Create(r.Context(), tenantID, claims.UserID, body.Name, body.Role, body.ExpiresAt)
	if err != nil {
		InternalError(w)
		return
	}

	resp := serializeMcpApiKey(key)
	resp["key"] = fullKey
	JSON(w, http.StatusCreated, resp)
}

// DELETE /admin/tenants/{tenantId}/mcp-keys/{keyId}
func (h *AdminMcpKeysHandler) Revoke(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	keyID := chi.URLParam(r, "keyId")

	err := h.repo.Revoke(r.Context(), keyID, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func serializeMcpApiKey(k repository.McpApiKey) map[string]any {
	return map[string]any{
		"id":           k.ID,
		"tenant_id":    k.TenantID,
		"name":         k.Name,
		"key_prefix":   k.KeyPrefix,
		"role":         k.Role,
		"created_by":   k.CreatedBy,
		"last_used_at": k.LastUsedAt,
		"expires_at":   k.ExpiresAt,
		"revoked_at":   k.RevokedAt,
		"created_at":   k.CreatedAt,
	}
}
