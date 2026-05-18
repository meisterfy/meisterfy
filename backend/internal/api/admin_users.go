package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/middleware"
)

type adminUserRepo interface {
	ListForTenant(ctx context.Context, tenantID string, active *bool) ([]*domain.User, error)
	GetByID(ctx context.Context, id string) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	Create(ctx context.Context, u *domain.User) error
	Update(ctx context.Context, u *domain.User) error
	Delete(ctx context.Context, id string) error
	SetSystemRole(ctx context.Context, userID, role string) error
}

type adminRBACRepo interface {
	AssignRole(ctx context.Context, userID, tenantID, roleID string) error
	RemoveRole(ctx context.Context, userID, tenantID, roleID string) error
	GetRoleForUser(ctx context.Context, userID, tenantID string) (*domain.Role, error)
	GetRolesForUsers(ctx context.Context, userIDs []string, tenantID string) (map[string]*domain.Role, error)
	RemoveAllRolesForUserInTenant(ctx context.Context, userID, tenantID string) error
}

type AdminUsersHandler struct {
	userRepo adminUserRepo
	rbacRepo adminRBACRepo
	audit    AuditLogRepo
}

func NewAdminUsersHandler(userRepo adminUserRepo, rbacRepo adminRBACRepo, audit AuditLogRepo) *AdminUsersHandler {
	return &AdminUsersHandler{userRepo: userRepo, rbacRepo: rbacRepo, audit: audit}
}

type roleRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type userAdminResponse struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Email      string    `json:"email"`
	Locale     string    `json:"locale"`
	Timezone   string    `json:"timezone"`
	IsActive   bool      `json:"is_active"`
	SystemRole string    `json:"system_role"`
	Role       *roleRef  `json:"role,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func effectiveTenantID(r *http.Request, claims *domain.UserClaims) string {
	if t := r.URL.Query().Get("tenant_id"); t != "" {
		return t
	}
	if claims != nil {
		return claims.TenantID
	}
	return ""
}

func (h *AdminUsersHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	tenantID := effectiveTenantID(r, claims)
	var active *bool
	if v := r.URL.Query().Get("active"); v == "true" {
		t := true
		active = &t
	} else if v == "false" {
		f := false
		active = &f
	}
	users, err := h.userRepo.ListForTenant(r.Context(), tenantID, active)
	if err != nil {
		InternalError(w)
		return
	}
	ids := make([]string, len(users))
	for i, u := range users {
		ids[i] = u.ID
	}
	roles, _ := h.rbacRepo.GetRolesForUsers(r.Context(), ids, tenantID)
	data := make([]userAdminResponse, len(users))
	for i, u := range users {
		resp := toUserAdminResponse(u)
		if role, ok := roles[u.ID]; ok {
			resp.Role = &roleRef{ID: role.ID, Name: role.Name}
		}
		data[i] = resp
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

func (h *AdminUsersHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	tenantID := effectiveTenantID(r, claims)
	u, err := h.userRepo.GetByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	// Ensure the target user belongs to the caller's tenant.
	if role, _ := h.rbacRepo.GetRoleForUser(r.Context(), u.ID, tenantID); role == nil {
		NotFound(w)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"data": toUserAdminResponse(u)})
}

func (h *AdminUsersHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())

	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		RoleID   string `json:"role_id"`
		TenantID string `json:"tenant_id"`
		Locale   string `json:"locale"`
		Timezone string `json:"timezone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Name == "" || req.Email == "" || req.Password == "" {
		UnprocessableEntity(w, "name, email and password are required")
		return
	}
	if len(req.Password) < 8 {
		UnprocessableEntity(w, "password must be at least 8 characters")
		return
	}

	u := &domain.User{
		ID:       domain.NewID(),
		Name:     req.Name,
		Email:    req.Email,
		Locale:   req.Locale,
		Timezone: req.Timezone,
		IsActive: true,
	}
	if u.Locale == "" {
		u.Locale = "en"
	}
	if u.Timezone == "" {
		u.Timezone = "UTC"
	}
	if err := u.SetPassword(req.Password); err != nil {
		InternalError(w)
		return
	}
	tenantID := req.TenantID
	if tenantID == "" {
		tenantID = claims.TenantID
	}

	// Upsert: if email already exists and user is inactive, reactivate instead of 409.
	existing, _ := h.userRepo.GetByEmail(r.Context(), req.Email)
	if existing != nil {
		if existing.IsActive {
			Error(w, http.StatusConflict, "email already in use")
			return
		}
		existing.IsActive = true
		existing.Name = req.Name
		existing.Locale = u.Locale
		existing.Timezone = u.Timezone
		if err := existing.SetPassword(req.Password); err != nil {
			InternalError(w)
			return
		}
		if err := h.userRepo.Update(r.Context(), existing); err != nil {
			InternalError(w)
			return
		}
		if req.RoleID != "" {
			_ = h.rbacRepo.RemoveAllRolesForUserInTenant(r.Context(), existing.ID, tenantID)
			if err := h.rbacRepo.AssignRole(r.Context(), existing.ID, tenantID, req.RoleID); err != nil {
				InternalError(w)
				return
			}
		}
		if claims != nil && h.audit != nil {
			h.audit.AsyncLog(domain.AuditEntry{
				TenantID: tenantID, UserID: claims.UserID, UserName: claims.UserName,
				Action: "user.reactivated", EntityType: "user", EntityID: existing.ID, EntityName: &existing.Name,
				After: toUserAdminResponse(existing), IP: auditIP(r),
			})
		}
		JSON(w, http.StatusOK, map[string]any{"data": toUserAdminResponse(existing)})
		return
	}

	if err := h.userRepo.Create(r.Context(), u); err != nil {
		if errors.Is(err, domain.ErrConflict) {
			Error(w, http.StatusConflict, "email already in use")
			return
		}
		InternalError(w)
		return
	}
	if req.RoleID != "" {
		if err := h.rbacRepo.AssignRole(r.Context(), u.ID, tenantID, req.RoleID); err != nil {
			InternalError(w)
			return
		}
	}
	if claims != nil && h.audit != nil {
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: tenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "user.created", EntityType: "user", EntityID: u.ID, EntityName: &u.Name,
			After: toUserAdminResponse(u), IP: auditIP(r),
		})
	}
	JSON(w, http.StatusCreated, map[string]any{"data": toUserAdminResponse(u)})
}

func (h *AdminUsersHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	tenantID := effectiveTenantID(r, claims)
	u, err := h.userRepo.GetByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	if role, _ := h.rbacRepo.GetRoleForUser(r.Context(), u.ID, tenantID); role == nil {
		NotFound(w)
		return
	}

	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Locale   string `json:"locale"`
		Timezone string `json:"timezone"`
		IsActive *bool  `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}

	if req.Name != "" {
		u.Name = req.Name
	}
	if req.Email != "" {
		u.Email = strings.ToLower(strings.TrimSpace(req.Email))
	}
	if req.Locale != "" {
		u.Locale = req.Locale
	}
	if req.Timezone != "" {
		u.Timezone = req.Timezone
	}
	if req.IsActive != nil {
		u.IsActive = *req.IsActive
	}

	if err := h.userRepo.Update(r.Context(), u); err != nil {
		if errors.Is(err, domain.ErrConflict) {
			Error(w, http.StatusConflict, "email already in use")
			return
		}
		InternalError(w)
		return
	}
	if claims != nil && h.audit != nil {
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: tenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "user.updated", EntityType: "user", EntityID: u.ID, EntityName: &u.Name,
			After: toUserAdminResponse(u), IP: auditIP(r),
		})
	}
	JSON(w, http.StatusOK, map[string]any{"data": toUserAdminResponse(u)})
}

func (h *AdminUsersHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	tenantID := effectiveTenantID(r, claims)
	id := chi.URLParam(r, "id")
	u, err := h.userRepo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	if role, _ := h.rbacRepo.GetRoleForUser(r.Context(), u.ID, tenantID); role == nil {
		NotFound(w)
		return
	}
	before := toUserAdminResponse(u)
	u.IsActive = false
	if err := h.userRepo.Update(r.Context(), u); err != nil {
		InternalError(w)
		return
	}
	_ = h.rbacRepo.RemoveAllRolesForUserInTenant(r.Context(), id, tenantID)
	if h.audit != nil {
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: tenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "user.deactivated", EntityType: "user", EntityID: id, EntityName: &u.Name,
			Before: before, IP: auditIP(r),
		})
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminUsersHandler) Reactivate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	tenantID := effectiveTenantID(r, claims)
	id := chi.URLParam(r, "id")

	var req struct {
		RoleID string `json:"role_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RoleID == "" {
		UnprocessableEntity(w, "role_id is required")
		return
	}

	u, err := h.userRepo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	u.IsActive = true
	if err := h.userRepo.Update(r.Context(), u); err != nil {
		InternalError(w)
		return
	}
	_ = h.rbacRepo.RemoveAllRolesForUserInTenant(r.Context(), id, tenantID)
	if err := h.rbacRepo.AssignRole(r.Context(), id, tenantID, req.RoleID); err != nil {
		InternalError(w)
		return
	}
	if h.audit != nil {
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: tenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "user.reactivated", EntityType: "user", EntityID: id, EntityName: &u.Name,
			After: toUserAdminResponse(u), IP: auditIP(r),
		})
	}
	JSON(w, http.StatusOK, map[string]any{"data": toUserAdminResponse(u)})
}

func (h *AdminUsersHandler) AssignRole(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	userID := chi.URLParam(r, "id")

	var req struct {
		RoleID string `json:"role_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RoleID == "" {
		UnprocessableEntity(w, "role_id is required")
		return
	}
	tenantID := effectiveTenantID(r, claims)

	// Ensure the target user belongs to this tenant before changing their role.
	if target, _ := h.userRepo.GetByID(r.Context(), userID); target == nil {
		NotFound(w)
		return
	}
	if role, _ := h.rbacRepo.GetRoleForUser(r.Context(), userID, tenantID); role == nil {
		NotFound(w)
		return
	}

	if err := h.rbacRepo.RemoveAllRolesForUserInTenant(r.Context(), userID, tenantID); err != nil {
		InternalError(w)
		return
	}
	if err := h.rbacRepo.AssignRole(r.Context(), userID, tenantID, req.RoleID); err != nil {
		InternalError(w)
		return
	}
	if claims != nil && h.audit != nil {
		h.audit.AsyncLog(domain.AuditEntry{
			TenantID: tenantID, UserID: claims.UserID, UserName: claims.UserName,
			Action: "user.role_assigned", EntityType: "user", EntityID: userID,
			After: map[string]any{"role_id": req.RoleID, "tenant_id": tenantID}, IP: auditIP(r),
		})
	}
	w.WriteHeader(http.StatusNoContent)
}

func toUserAdminResponse(u *domain.User) userAdminResponse {
	return userAdminResponse{
		ID:         u.ID,
		Name:       u.Name,
		Email:      u.Email,
		Locale:     u.Locale,
		Timezone:   u.Timezone,
		IsActive:   u.IsActive,
		SystemRole: u.SystemRole,
		CreatedAt:  u.CreatedAt,
		UpdatedAt:  u.UpdatedAt,
	}
}

func (h *AdminUsersHandler) SetSystemRole(w http.ResponseWriter, r *http.Request) {
	callerClaims := middleware.UserClaimsFromContext(r.Context())
	targetID := chi.URLParam(r, "id")

	if callerClaims != nil && callerClaims.UserID == targetID {
		Error(w, http.StatusUnprocessableEntity, "cannot change your own system role")
		return
	}

	var req struct {
		SystemRole string `json:"system_role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.SystemRole != "user" && req.SystemRole != "platform_admin" {
		UnprocessableEntity(w, "system_role must be 'user' or 'platform_admin'")
		return
	}

	if err := h.userRepo.SetSystemRole(r.Context(), targetID, req.SystemRole); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
