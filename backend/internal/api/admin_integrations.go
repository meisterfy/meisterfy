package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mkt-maestro/mkt-maestro/internal/connector"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/middleware"
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
	audit AuditLogRepo
}

func NewAdminIntegrationsHandler(
	repo interface {
		List(ctx context.Context) ([]*domain.Integration, error)
		GetByID(ctx context.Context, id string) (*domain.Integration, error)
		Create(ctx context.Context, ig *domain.Integration) error
		Update(ctx context.Context, ig *domain.Integration) error
		Delete(ctx context.Context, id string) error
		SetTenants(ctx context.Context, integrationID string, tenantIDs []string) error
	},
	audit AuditLogRepo,
) *AdminIntegrationsHandler {
	return &AdminIntegrationsHandler{repo: repo, audit: audit}
}

type integrationResponse struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	Provider       string         `json:"provider"`
	Group          string         `json:"group"`
	Status         string         `json:"status"`
	ErrorMessage   *string        `json:"error_message"`
	TenantIDs      []string       `json:"tenant_ids"`
	Config         map[string]any `json:"config"`
	HasCredentials bool           `json:"has_credentials"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

const masked = "***"

// hardcodedField maps a schema key to its corresponding Integration struct field value.
// Returns (value, true) when the key is a hardcoded credential field, (nil, false) otherwise.
func hardcodedField(ig *domain.Integration, key string) (*string, bool) {
	switch key {
	case "developer_token":
		return ig.DeveloperToken, true
	case "login_customer_id":
		return ig.LoginCustomerID, true
	case "oauth_client_id":
		return ig.OAuthClientID, true
	case "oauth_client_secret":
		return ig.OAuthClientSecret, true
	}
	return nil, false
}

func toIntegrationResponse(ig *domain.Integration) integrationResponse {
	tenantIDs := ig.TenantIDs
	if tenantIDs == nil {
		tenantIDs = []string{}
	}

	cfg := map[string]any{}
	schema, _ := connector.GetProvider(ig.Provider)
	if schema != nil {
		allFields := append(schema.ConfigFields, schema.CredentialFields...)
		for _, f := range allFields {
			val, hardcoded := hardcodedField(ig, f.Key)
			if hardcoded {
				if val != nil {
					if f.Type == connector.FieldTypePassword {
						cfg[f.Key] = masked
					} else {
						cfg[f.Key] = *val
					}
				}
			} else {
				// generic config field stored in JSONB
				if v, ok := ig.Config[f.Key]; ok && v != nil {
					if f.Type == connector.FieldTypePassword {
						cfg[f.Key] = masked
					} else {
						cfg[f.Key] = v
					}
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

func providerSchemaResponse(s *connector.IntegrationSchema) map[string]any {
	configFields := s.ConfigFields
	if configFields == nil {
		configFields = []connector.FieldSchema{}
	}
	credFields := s.CredentialFields
	if credFields == nil {
		credFields = []connector.FieldSchema{}
	}
	return map[string]any{
		"provider":          s.Provider,
		"group":             s.Group,
		"display_name":      s.DisplayName,
		"description":       s.Description,
		"logo_svg":          s.LogoSVG,
		"config_fields":     configFields,
		"credential_fields": credFields,
		"oauth_flow":        s.OAuthFlow,
		"oauth_start_path":  s.OAuthStartPath,
	}
}

// applyFieldToIntegration sets a schema field value on the integration, dispatching
// hardcoded credential fields to their struct fields and everything else to Config.
func applyFieldToIntegration(ig *domain.Integration, f connector.FieldSchema, raw string) {
	val := &raw
	switch f.Key {
	case "oauth_client_id":
		ig.OAuthClientID = val
	case "oauth_client_secret":
		ig.OAuthClientSecret = val
	case "developer_token":
		ig.DeveloperToken = val
	case "login_customer_id":
		ig.LoginCustomerID = val
	default:
		if ig.Config == nil {
			ig.Config = map[string]any{}
		}
		ig.Config[f.Key] = raw
	}
}

// GET /admin/integrations
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
	claims := middleware.UserClaimsFromContext(r.Context())
	var req struct {
		Name      string            `json:"name"`
		Provider  string            `json:"provider"`
		TenantIDs []string          `json:"tenant_ids"`
		Fields    map[string]string `json:"-"`
	}

	// Decode into a raw map to capture all dynamic fields.
	var rawBody map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&rawBody); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}

	if v, ok := rawBody["name"]; ok {
		_ = json.Unmarshal(v, &req.Name)
	}
	if v, ok := rawBody["provider"]; ok {
		_ = json.Unmarshal(v, &req.Provider)
	}
	if v, ok := rawBody["tenant_ids"]; ok {
		_ = json.Unmarshal(v, &req.TenantIDs)
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
		ID:       domain.NewID(),
		Name:     req.Name,
		Provider: provider,
		Group:    schema.Group,
		Status:   domain.StatusPending,
		Config:   map[string]any{},
	}

	// Apply all declared schema fields from the request body.
	for _, f := range append(schema.ConfigFields, schema.CredentialFields...) {
		raw, ok := rawBody[f.Key]
		if !ok {
			continue
		}
		var val string
		if err := json.Unmarshal(raw, &val); err != nil || val == "" {
			continue
		}
		applyFieldToIntegration(ig, f, val)
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
	if claims != nil && h.audit != nil && claims.TenantID != "" {
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: claims.TenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "integration.created", EntityType: "integration", EntityID: created.ID, EntityName: &created.Name,
			After: map[string]any{"provider": created.Provider, "name": created.Name}, IP: auditIP(r),
		})
	}
	JSON(w, http.StatusCreated, map[string]any{"data": toIntegrationResponse(created)})
}

// PUT /admin/integrations/{id}
// Fields with value "***" are skipped (keep stored value).
func (h *AdminIntegrationsHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
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

	var rawBody map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&rawBody); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}

	if v, ok := rawBody["name"]; ok {
		var name string
		if err := json.Unmarshal(v, &name); err == nil && name != "" {
			ig.Name = name
		}
	}

	var tenantIDs []string
	if v, ok := rawBody["tenant_ids"]; ok {
		_ = json.Unmarshal(v, &tenantIDs)
	}

	schema, _ := connector.GetProvider(ig.Provider)
	if schema != nil {
		for _, f := range append(schema.ConfigFields, schema.CredentialFields...) {
			raw, ok := rawBody[f.Key]
			if !ok {
				continue
			}
			var val string
			if err := json.Unmarshal(raw, &val); err != nil || val == "" || val == masked {
				continue
			}
			applyFieldToIntegration(ig, f, val)
		}
	}

	if err := h.repo.Update(r.Context(), ig); err != nil {
		InternalError(w)
		return
	}

	if tenantIDs != nil {
		if err := h.repo.SetTenants(r.Context(), id, tenantIDs); err != nil {
			InternalError(w)
			return
		}
		ig.TenantIDs = tenantIDs
	}

	updated, _ := h.repo.GetByID(r.Context(), id)
	if updated == nil {
		updated = ig
	}
	if claims != nil && h.audit != nil && claims.TenantID != "" {
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: claims.TenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "integration.updated", EntityType: "integration", EntityID: id, EntityName: &updated.Name,
			After: map[string]any{"provider": updated.Provider, "name": updated.Name}, IP: auditIP(r),
		})
	}
	JSON(w, http.StatusOK, map[string]any{"data": toIntegrationResponse(updated)})
}

// DELETE /admin/integrations/{id}
func (h *AdminIntegrationsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	id := chi.URLParam(r, "id")
	before, _ := h.repo.GetByID(r.Context(), id)
	if err := h.repo.Delete(r.Context(), id); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	if claims != nil && h.audit != nil && before != nil && claims.TenantID != "" {
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: claims.TenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "integration.deleted", EntityType: "integration", EntityID: id, EntityName: &before.Name,
			Before: map[string]any{"provider": before.Provider, "name": before.Name}, IP: auditIP(r),
		})
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
