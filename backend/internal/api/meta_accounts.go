package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/mkt-maestro/mkt-maestro/internal/connector/meta"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
)

type MetaAccountsHandler struct {
	integrationRepo interface {
		GetForTenant(ctx context.Context, tenantID, provider string) (*domain.Integration, error)
	}
	resourceStore interface {
		List(ctx context.Context, tenantID string, provider domain.IntegrationProvider, resourceType string) ([]*domain.ConnectorResource, error)
		Upsert(ctx context.Context, res *domain.ConnectorResource) error
		Delete(ctx context.Context, id string) error
	}
}

func NewMetaAccountsHandler(
	integrationRepo interface {
		GetForTenant(ctx context.Context, tenantID, provider string) (*domain.Integration, error)
	},
	resourceStore interface {
		List(ctx context.Context, tenantID string, provider domain.IntegrationProvider, resourceType string) ([]*domain.ConnectorResource, error)
		Upsert(ctx context.Context, res *domain.ConnectorResource) error
		Delete(ctx context.Context, id string) error
	},
) *MetaAccountsHandler {
	return &MetaAccountsHandler{integrationRepo: integrationRepo, resourceStore: resourceStore}
}

// GET /admin/tenants/{tenantId}/meta/available-pages
func (h *MetaAccountsHandler) ListAvailablePages(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	ig, err := h.integrationRepo.GetForTenant(r.Context(), tenantID, string(domain.ProviderMeta))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			Error(w, http.StatusBadRequest, "no connected Meta integration")
			return
		}
		InternalError(w)
		return
	}
	if ig.RefreshToken == nil {
		Error(w, http.StatusBadRequest, "no connected Meta integration")
		return
	}

	client := meta.NewClient(*ig.RefreshToken)
	pages, err := client.GetAccounts(r.Context())
	if err != nil {
		InternalError(w)
		return
	}

	existing, err := h.resourceStore.List(r.Context(), tenantID, domain.ProviderMeta, "page")
	if err != nil {
		InternalError(w)
		return
	}
	connected := make(map[string]bool, len(existing))
	for _, res := range existing {
		connected[res.ResourceID] = true
	}

	type pageItem struct {
		PageID          string `json:"page_id"`
		PageName        string `json:"page_name"`
		IGUserID        string `json:"ig_user_id"`
		IGUsername      string `json:"ig_username"`
		AlreadyConnected bool  `json:"already_connected"`
	}

	items := make([]pageItem, 0, len(pages))
	for _, page := range pages {
		item := pageItem{
			PageID:           page.ID,
			PageName:         page.Name,
			AlreadyConnected: connected[page.ID],
		}
		igAccount, _ := client.GetIGAccount(r.Context(), page.ID, page.AccessToken)
		if igAccount != nil {
			item.IGUserID = igAccount.ID
			item.IGUsername = igAccount.Username
		}
		items = append(items, item)
	}

	JSON(w, http.StatusOK, map[string]any{"data": items})
}

// POST /admin/tenants/{tenantId}/meta/pages
func (h *MetaAccountsHandler) ActivatePage(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	var req struct {
		PageID     string `json:"page_id"`
		PageName   string `json:"page_name"`
		IGUserID   string `json:"ig_user_id"`
		IGUsername string `json:"ig_username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.PageID == "" || req.PageName == "" {
		UnprocessableEntity(w, "page_id and page_name are required")
		return
	}

	ig, err := h.integrationRepo.GetForTenant(r.Context(), tenantID, string(domain.ProviderMeta))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			Error(w, http.StatusBadRequest, "no connected Meta integration")
			return
		}
		InternalError(w)
		return
	}
	if ig.RefreshToken == nil {
		Error(w, http.StatusBadRequest, "no connected Meta integration")
		return
	}

	pages, err := meta.NewClient(*ig.RefreshToken).GetAccounts(r.Context())
	if err != nil {
		InternalError(w)
		return
	}

	var pageAccessToken string
	for _, p := range pages {
		if p.ID == req.PageID {
			pageAccessToken = p.AccessToken
			break
		}
	}
	if pageAccessToken == "" {
		Error(w, http.StatusBadRequest, "page not found in Meta account")
		return
	}

	name := req.PageName
	res := &domain.ConnectorResource{
		ID:            domain.NewID(),
		TenantID:      tenantID,
		IntegrationID: ig.ID,
		Provider:      domain.ProviderMeta,
		ResourceType:  "page",
		ResourceID:    req.PageID,
		ResourceName:  &name,
		Metadata: map[string]any{
			"page_access_token": pageAccessToken,
			"ig_user_id":        req.IGUserID,
			"ig_username":       req.IGUsername,
		},
	}
	if err := h.resourceStore.Upsert(r.Context(), res); err != nil {
		InternalError(w)
		return
	}

	JSON(w, http.StatusCreated, res)
}

// DELETE /admin/tenants/{tenantId}/meta/pages/{resourceId}
func (h *MetaAccountsHandler) RemovePage(w http.ResponseWriter, r *http.Request) {
	resourceID := chi.URLParam(r, "resourceId")

	if err := h.resourceStore.Delete(r.Context(), resourceID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		InternalError(w)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
