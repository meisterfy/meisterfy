package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rush-maestro/rush-maestro/internal/connector"
	"github.com/rush-maestro/rush-maestro/internal/domain"
)

type AdminIntegrationsHandler struct {
	repo interface {
		List(ctx context.Context) ([]*domain.Integration, error)
		GetByID(ctx context.Context, id string) (*domain.Integration, error)
		Create(ctx context.Context, ig *domain.Integration) error
		Update(ctx context.Context, ig *domain.Integration) error
		Delete(ctx context.Context, id string) error
		SetTenants(ctx context.Context, integrationID string, tenantIDs []string) error
	}
}

func NewAdminIntegrationsHandler(repo interface {
	List(ctx context.Context) ([]*domain.Integration, error)
	GetByID(ctx context.Context, id string) (*domain.Integration, error)
	Create(ctx context.Context, ig *domain.Integration) error
	Update(ctx context.Context, ig *domain.Integration) error
	Delete(ctx context.Context, id string) error
	SetTenants(ctx context.Context, integrationID string, tenantIDs []string) error
}) *AdminIntegrationsHandler {
	return &AdminIntegrationsHandler{repo: repo}
}

// integrationResponse is the safe, masked representation sent to clients.
type integrationResponse struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Provider       string    `json:"provider"`
	Group          string    `json:"group"`
	Status         string    `json:"status"`
	ErrorMessage   *string   `json:"error_message"`
	TenantIDs      []string  `json:"tenant_ids"`
	Config         map[string]any `json:"config"`
	HasCredentials bool      `json:"has_credentials"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

const masked = "***"

func toIntegrationResponse(ig *domain.Integration) integrationResponse {
	tenantIDs := ig.TenantIDs
	if tenantIDs == nil {
		tenantIDs = []string{}
	}

	cfg := map[string]any{}

	schema, _ := connector.GetProvider(ig.Provider)
	if schema != nil {
		for _, f := range schema.ConfigFields {
			val := fieldValue(ig, f.Key)
			if val != nil {
				if f.Type == connector.FieldTypePassword {
					cfg[f.Key] = masked
				} else {
					cfg[f.Key] = *val
				}
			}
		}
	}

	hasCreds := ig.OAuthClientID != nil || ig.OAuthClientSecret != nil || ig.RefreshToken != nil

	return integrationResponse{
		ID:             ig.ID,
		Name:           ig.Name,
		Provider:       string(ig.Provider),
		Group:          string(ig.Group),
		Status:         string(ig.Status),
		ErrorMessage:   ig.ErrorMessage,
		TenantIDs:      tenantIDs,
		Config:         cfg,
		HasCredentials: hasCreds,
		CreatedAt:      ig.CreatedAt,
		UpdatedAt:      ig.UpdatedAt,
	}
}

// fieldValue maps a schema key to the corresponding Integration field.
func fieldValue(ig *domain.Integration, key string) *string {
	switch key {
	case "developer_token":
		return ig.DeveloperToken
	case "login_customer_id":
		return ig.LoginCustomerID
	case "oauth_client_id":
		return ig.OAuthClientID
	case "oauth_client_secret":
		return ig.OAuthClientSecret
	}
	return nil
}

func providerSchemaResponse(s *connector.IntegrationSchema) map[string]any {
	return map[string]any{
		"provider":          s.Provider,
		"group":             s.Group,
		"display_name":      s.DisplayName,
		"description":       s.Description,
		"logo_svg":          s.LogoSVG,
		"config_fields":     s.ConfigFields,
		"credential_fields": s.CredentialFields,
		"oauth_flow":        s.OAuthFlow,
		"oauth_start_path":  s.OAuthStartPath,
	}
}

// GET /admin/integrations
// GET /admin/integrations (combined: integrations list + provider schemas)
func (h *AdminIntegrationsHandler) List(w http.ResponseWriter, r *http.Request) {
	integrations, err := h.repo.List(r.Context())
	if err != nil {
		InternalError(w)
		return
	}
	data := make([]integrationResponse, len(integrations))
	for i, ig := range integrations {
		data[i] = toIntegrationResponse(ig)
	}

	providers := connector.ListProviders()
	providerData := make([]map[string]any, len(providers))
	for i, p := range providers {
		providerData[i] = providerSchemaResponse(p)
	}

	JSON(w, http.StatusOK, map[string]any{
		"integrations": data,
		"providers":    providerData,
	})
}

// GET /admin/integrations/providers
func (h *AdminIntegrationsHandler) ListProviders(w http.ResponseWriter, r *http.Request) {
	providers := connector.ListProviders()
	data := make([]map[string]any, len(providers))
	for i, p := range providers {
		data[i] = providerSchemaResponse(p)
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

// GET /admin/integrations/{id}
func (h *AdminIntegrationsHandler) Get(w http.ResponseWriter, r *http.Request) {
	ig, err := h.repo.GetByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"data": toIntegrationResponse(ig)})
}

// POST /admin/integrations
func (h *AdminIntegrationsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name              string   `json:"name"`
		Provider          string   `json:"provider"`
		OAuthClientID     *string  `json:"oauth_client_id"`
		OAuthClientSecret *string  `json:"oauth_client_secret"`
		DeveloperToken    *string  `json:"developer_token"`
		LoginCustomerID   *string  `json:"login_customer_id"`
		TenantIDs         []string `json:"tenant_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.Name == "" || req.Provider == "" {
		UnprocessableEntity(w, "name and provider are required")
		return
	}

	provider := domain.IntegrationProvider(req.Provider)
	schema, err := connector.GetProvider(provider)
	if err != nil {
		UnprocessableEntity(w, "unknown provider: "+req.Provider)
		return
	}

	ig := &domain.Integration{
		ID:                domain.NewID(),
		Name:              req.Name,
		Provider:          provider,
		Group:             schema.Group,
		OAuthClientID:     req.OAuthClientID,
		OAuthClientSecret: req.OAuthClientSecret,
		DeveloperToken:    req.DeveloperToken,
		LoginCustomerID:   req.LoginCustomerID,
		Status:            domain.StatusPending,
	}

	if err := h.repo.Create(r.Context(), ig); err != nil {
		InternalError(w)
		return
	}

	if len(req.TenantIDs) > 0 {
		_ = h.repo.SetTenants(r.Context(), ig.ID, req.TenantIDs)
		ig.TenantIDs = req.TenantIDs
	}

	created, _ := h.repo.GetByID(r.Context(), ig.ID)
	if created == nil {
		created = ig
	}
	JSON(w, http.StatusCreated, map[string]any{"data": toIntegrationResponse(created)})
}

// PUT /admin/integrations/{id}
// Fields with value "***" are skipped (keep stored value).
func (h *AdminIntegrationsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ig, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	var req struct {
		Name              *string  `json:"name"`
		OAuthClientID     *string  `json:"oauth_client_id"`
		OAuthClientSecret *string  `json:"oauth_client_secret"`
		DeveloperToken    *string  `json:"developer_token"`
		LoginCustomerID   *string  `json:"login_customer_id"`
		TenantIDs         []string `json:"tenant_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}

	if req.Name != nil {
		ig.Name = *req.Name
	}
	if req.OAuthClientID != nil && *req.OAuthClientID != masked {
		ig.OAuthClientID = req.OAuthClientID
	}
	if req.OAuthClientSecret != nil && *req.OAuthClientSecret != masked {
		ig.OAuthClientSecret = req.OAuthClientSecret
	}
	if req.DeveloperToken != nil && *req.DeveloperToken != masked {
		ig.DeveloperToken = req.DeveloperToken
	}
	if req.LoginCustomerID != nil && *req.LoginCustomerID != masked {
		ig.LoginCustomerID = req.LoginCustomerID
	}

	if err := h.repo.Update(r.Context(), ig); err != nil {
		InternalError(w)
		return
	}

	if req.TenantIDs != nil {
		_ = h.repo.SetTenants(r.Context(), id, req.TenantIDs)
		ig.TenantIDs = req.TenantIDs
	}

	updated, _ := h.repo.GetByID(r.Context(), id)
	if updated == nil {
		updated = ig
	}
	JSON(w, http.StatusOK, map[string]any{"data": toIntegrationResponse(updated)})
}

// DELETE /admin/integrations/{id}
func (h *AdminIntegrationsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.repo.Delete(r.Context(), chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /admin/integrations/{id}/test
func (h *AdminIntegrationsHandler) Test(w http.ResponseWriter, r *http.Request) {
	ig, err := h.repo.GetByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	schema, err := connector.GetProvider(ig.Provider)
	if err != nil || schema.TestConnection == nil {
		JSON(w, http.StatusOK, map[string]any{"ok": false, "error": "test not implemented for this provider"})
		return
	}

	testErr := schema.TestConnection(r.Context(), ig)
	if testErr != nil {
		errMsg := testErr.Error()
		ig.Status = domain.StatusError
		ig.ErrorMessage = &errMsg
		_ = h.repo.Update(r.Context(), ig)
		JSON(w, http.StatusOK, map[string]any{"ok": false, "error": errMsg})
		return
	}

	ig.Status = domain.StatusConnected
	ig.ErrorMessage = nil
	_ = h.repo.Update(r.Context(), ig)
	JSON(w, http.StatusOK, map[string]any{"ok": true})
}

// PUT /admin/integrations/{id}/tenants
func (h *AdminIntegrationsHandler) SetTenants(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.repo.GetByID(r.Context(), id); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	var req struct {
		TenantIDs []string `json:"tenant_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}

	if err := h.repo.SetTenants(r.Context(), id, req.TenantIDs); err != nil {
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
