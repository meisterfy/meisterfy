package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/meisterfy/meisterfy/internal/connector"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/middleware"
)

type tenantConnectorResponse struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	LogoSVG string `json:"logo_svg"`
	LogoPNG string `json:"logo_png"`
}

type AdminTenantsHandler struct {
	tenantRepo interface {
		List(ctx context.Context) ([]*domain.Tenant, error)
		ListByIDs(ctx context.Context, ids []string) ([]*domain.Tenant, error)
		GetByID(ctx context.Context, id string) (*domain.Tenant, error)
		Create(ctx context.Context, t *domain.Tenant) error
		Update(ctx context.Context, t *domain.Tenant) error
		Delete(ctx context.Context, id string) error
	}
	integrationRepo interface {
		ListConnectedProvidersByTenant(ctx context.Context) (map[string][]domain.IntegrationProvider, error)
	}
	rbacRepo interface {
		AssignRole(ctx context.Context, userID, tenantID, roleID string) error
		GetTenantsForUser(ctx context.Context, userID string) ([]string, error)
	}
	audit AuditLogRepo
}

func NewAdminTenantsHandler(
	tenantRepo interface {
		List(ctx context.Context) ([]*domain.Tenant, error)
		ListByIDs(ctx context.Context, ids []string) ([]*domain.Tenant, error)
		GetByID(ctx context.Context, id string) (*domain.Tenant, error)
		Create(ctx context.Context, t *domain.Tenant) error
		Update(ctx context.Context, t *domain.Tenant) error
		Delete(ctx context.Context, id string) error
	},
	integrationRepo interface {
		ListConnectedProvidersByTenant(ctx context.Context) (map[string][]domain.IntegrationProvider, error)
	},
	rbacRepo interface {
		AssignRole(ctx context.Context, userID, tenantID, roleID string) error
		GetTenantsForUser(ctx context.Context, userID string) ([]string, error)
	},
	audit AuditLogRepo,
) *AdminTenantsHandler {
	return &AdminTenantsHandler{tenantRepo: tenantRepo, integrationRepo: integrationRepo, rbacRepo: rbacRepo, audit: audit}
}

func (h *AdminTenantsHandler) listAccessibleTenants(ctx context.Context, claims *domain.UserClaims) ([]*domain.Tenant, error) {
	if claims.HasPermission("view-any:tenant") {
		return h.tenantRepo.List(ctx)
	}
	ids, err := h.rbacRepo.GetTenantsForUser(ctx, claims.UserID)
	if err != nil {
		return nil, err
	}
	return h.tenantRepo.ListByIDs(ctx, ids)
}

func connectorsForTenant(tenantID string, byTenant map[string][]domain.IntegrationProvider) []tenantConnectorResponse {
	providers := byTenant[tenantID]
	if len(providers) == 0 {
		return []tenantConnectorResponse{}
	}
	out := make([]tenantConnectorResponse, 0, len(providers))
	for _, p := range providers {
		schema, err := connector.GetProvider(p)
		if err != nil {
			out = append(out, tenantConnectorResponse{ID: string(p), Name: string(p)})
			continue
		}
		out = append(out, tenantConnectorResponse{
			ID:      string(p),
			Name:    schema.DisplayName,
			LogoSVG: schema.LogoSVG,
			LogoPNG: schema.LogoPNG,
		})
	}
	return out
}

type tenantResponse struct {
	ID             string                      `json:"id"`
	Name           string                      `json:"name"`
	Language       string                      `json:"language"`
	Niche          *string                     `json:"niche"`
	Location       *string                     `json:"location"`
	PrimaryPersona *string                     `json:"primary_persona"`
	Tone           *string                     `json:"tone"`
	Instructions   *string                     `json:"instructions"`
	Hashtags       []string                    `json:"hashtags"`
	AdsMonitoring  *domain.AdsMonitoringConfig `json:"ads_monitoring"`
	ReportPrompts  *domain.ReportPrompts       `json:"report_prompts"`
	Connectors     []tenantConnectorResponse   `json:"connectors"`
	CreatedAt      time.Time                   `json:"created_at"`
	UpdatedAt      time.Time                   `json:"updated_at"`
}

func toTenantResponse(t *domain.Tenant, connectors []tenantConnectorResponse) tenantResponse {
	hashtags := t.Hashtags
	if hashtags == nil {
		hashtags = []string{}
	}
	if connectors == nil {
		connectors = []tenantConnectorResponse{}
	}
	return tenantResponse{
		ID:             t.ID,
		Name:           t.Name,
		Language:       t.Language,
		Niche:          t.Niche,
		Location:       t.Location,
		PrimaryPersona: t.PrimaryPersona,
		Tone:           t.Tone,
		Instructions:   t.Instructions,
		Hashtags:       hashtags,
		AdsMonitoring:  t.AdsMonitoring,
		ReportPrompts:  t.ReportPrompts,
		Connectors:     connectors,
		CreatedAt:      t.CreatedAt,
		UpdatedAt:      t.UpdatedAt,
	}
}

func (h *AdminTenantsHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	if claims == nil {
		Unauthorized(w)
		return
	}
	tenants, err := h.listAccessibleTenants(r.Context(), claims)
	if err != nil {
		InternalError(w)
		return
	}
	providersByTenant, err := h.integrationRepo.ListConnectedProvidersByTenant(r.Context())
	if err != nil {
		InternalError(w)
		return
	}
	data := make([]tenantResponse, len(tenants))
	for i, t := range tenants {
		data[i] = toTenantResponse(t, connectorsForTenant(t.ID, providersByTenant))
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

func (h *AdminTenantsHandler) Get(w http.ResponseWriter, r *http.Request) {
	t, err := h.tenantRepo.GetByID(r.Context(), chi.URLParam(r, "tenantId"))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	providersByTenant, err := h.integrationRepo.ListConnectedProvidersByTenant(r.Context())
	if err != nil {
		InternalError(w)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"data": toTenantResponse(t, connectorsForTenant(t.ID, providersByTenant))})
}

func (h *AdminTenantsHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())

	var req struct {
		ID             string                      `json:"id"`
		Name           string                      `json:"name"`
		Language       string                      `json:"language"`
		Niche          *string                     `json:"niche"`
		Location       *string                     `json:"location"`
		PrimaryPersona *string                     `json:"primary_persona"`
		Tone           *string                     `json:"tone"`
		Instructions   *string                     `json:"instructions"`
		Hashtags       []string                    `json:"hashtags"`
		AdsMonitoring  *domain.AdsMonitoringConfig `json:"ads_monitoring"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.ID == "" || req.Name == "" {
		UnprocessableEntity(w, "id and name are required")
		return
	}
	if req.Language == "" {
		req.Language = "pt_BR"
	}
	if req.AdsMonitoring != nil {
		if err := req.AdsMonitoring.Validate(); err != nil {
			UnprocessableEntity(w, err.Error())
			return
		}
	}

	t := &domain.Tenant{
		ID:             req.ID,
		Name:           req.Name,
		Language:       req.Language,
		Niche:          req.Niche,
		Location:       req.Location,
		PrimaryPersona: req.PrimaryPersona,
		Tone:           req.Tone,
		Instructions:   req.Instructions,
		Hashtags:       req.Hashtags,
		AdsMonitoring:  req.AdsMonitoring,
	}
	if err := h.tenantRepo.Create(r.Context(), t); err != nil {
		if errors.Is(err, domain.ErrConflict) {
			Error(w, http.StatusConflict, "tenant id already in use")
			return
		}
		InternalError(w)
		return
	}

	if claims != nil {
		_ = h.rbacRepo.AssignRole(r.Context(), claims.UserID, t.ID, "role_owner")
	}

	created, _ := h.tenantRepo.GetByID(r.Context(), t.ID)
	if created == nil {
		created = t
	}
	if claims != nil && h.audit != nil {
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: claims.TenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "tenant.created", EntityType: "tenant", EntityID: created.ID, EntityName: &created.Name,
			After: toTenantResponse(created, nil), IP: auditIP(r),
		})
	}
	providersByTenant, err := h.integrationRepo.ListConnectedProvidersByTenant(r.Context())
	if err != nil {
		InternalError(w)
		return
	}
	JSON(w, http.StatusCreated, map[string]any{"data": toTenantResponse(created, connectorsForTenant(created.ID, providersByTenant))})
}

func (h *AdminTenantsHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	id := chi.URLParam(r, "tenantId")
	t, err := h.tenantRepo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	var req struct {
		Name          *string                     `json:"name"`
		Language       *string                     `json:"language"`
		Niche          *string                     `json:"niche"`
		Location       *string                     `json:"location"`
		PrimaryPersona *string                     `json:"primary_persona"`
		Tone           *string                     `json:"tone"`
		Instructions   *string                     `json:"instructions"`
		Hashtags       []string                    `json:"hashtags"`
		AdsMonitoring  *domain.AdsMonitoringConfig `json:"ads_monitoring"`
		ReportPrompts  *domain.ReportPrompts        `json:"report_prompts"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}

	providersByTenant, err := h.integrationRepo.ListConnectedProvidersByTenant(r.Context())
	if err != nil {
		InternalError(w)
		return
	}
	tenantConnectors := connectorsForTenant(t.ID, providersByTenant)
	beforeState := toTenantResponse(t, tenantConnectors)

	if req.Name != nil {
		t.Name = *req.Name
	}
	if req.Language != nil {
		t.Language = *req.Language
	}
	if req.Niche != nil {
		t.Niche = req.Niche
	}
	if req.Location != nil {
		t.Location = req.Location
	}
	if req.PrimaryPersona != nil {
		t.PrimaryPersona = req.PrimaryPersona
	}
	if req.Tone != nil {
		t.Tone = req.Tone
	}
	if req.Instructions != nil {
		t.Instructions = req.Instructions
	}
	if req.Hashtags != nil {
		t.Hashtags = req.Hashtags
	}
	if req.AdsMonitoring != nil {
		if err := req.AdsMonitoring.Validate(); err != nil {
			UnprocessableEntity(w, err.Error())
			return
		}
		t.AdsMonitoring = req.AdsMonitoring
	}
	if req.ReportPrompts != nil {
		t.ReportPrompts = req.ReportPrompts
	}

	afterState := toTenantResponse(t, tenantConnectors)
	bJSON, _ := json.Marshal(beforeState)
	aJSON, _ := json.Marshal(afterState)
	if string(bJSON) == string(aJSON) {
		JSON(w, http.StatusOK, map[string]any{"data": afterState})
		return
	}

	if err := h.tenantRepo.Update(r.Context(), t); err != nil {
		InternalError(w)
		return
	}
	if claims != nil && h.audit != nil {
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: t.ID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "tenant.updated", EntityType: "tenant", EntityID: t.ID, EntityName: &t.Name,
			Before: beforeState, After: afterState, IP: auditIP(r),
		})
	}
	JSON(w, http.StatusOK, map[string]any{"data": afterState})
}

func (h *AdminTenantsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	id := chi.URLParam(r, "tenantId")
	before, _ := h.tenantRepo.GetByID(r.Context(), id)
	if err := h.tenantRepo.Delete(r.Context(), id); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	if claims != nil && h.audit != nil && before != nil {
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: id, UserID: claims.UserID, UserName: claims.UserName,
			Action: "tenant.deleted", EntityType: "tenant", EntityID: id, EntityName: &before.Name,
			Before: toTenantResponse(before, nil), IP: auditIP(r),
		})
	}
	w.WriteHeader(http.StatusNoContent)
}
