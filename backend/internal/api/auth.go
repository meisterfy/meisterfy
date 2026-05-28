package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/middleware"
)

const refreshCookieName = "meisterfy_refresh"

type AuthHandler struct {
	userRepo interface {
		GetByEmail(ctx context.Context, email string) (*domain.User, error)
		GetByID(ctx context.Context, id string) (*domain.User, error)
		Update(ctx context.Context, u *domain.User) error
		UpdatePasswordHash(ctx context.Context, id, hash string) error
	}
	rbacRepo interface {
		GetTenantsForUser(ctx context.Context, userID string) ([]string, error)
		GetPermissionsForUser(ctx context.Context, userID, tenantID string) ([]string, error)
	}
	legalRepo interface {
		GetLatestVersion(ctx context.Context) (*domain.LegalTermVersion, error)
		HasUserAccepted(ctx context.Context, userID, versionID string) (bool, error)
		RecordAcceptance(ctx context.Context, userID, versionID, locale, ip string) error
	}
	jwtSvc        *domain.JWTService
	cookieDomain  string
	secureCookies bool
}

func NewAuthHandler(
	userRepo interface {
		GetByEmail(ctx context.Context, email string) (*domain.User, error)
		GetByID(ctx context.Context, id string) (*domain.User, error)
		Update(ctx context.Context, u *domain.User) error
		UpdatePasswordHash(ctx context.Context, id, hash string) error
	},
	rbacRepo interface {
		GetTenantsForUser(ctx context.Context, userID string) ([]string, error)
		GetPermissionsForUser(ctx context.Context, userID, tenantID string) ([]string, error)
	},
	legalRepo interface {
		GetLatestVersion(ctx context.Context) (*domain.LegalTermVersion, error)
		HasUserAccepted(ctx context.Context, userID, versionID string) (bool, error)
		RecordAcceptance(ctx context.Context, userID, versionID, locale, ip string) error
	},
	jwtSvc *domain.JWTService,
	cookieDomain string,
	secureCookies bool,
) *AuthHandler {
	return &AuthHandler{
		userRepo:      userRepo,
		rbacRepo:      rbacRepo,
		legalRepo:     legalRepo,
		jwtSvc:        jwtSvc,
		cookieDomain:  cookieDomain,
		secureCookies: secureCookies,
	}
}

type userResponse struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Locale     string `json:"locale"`
	Timezone   string `json:"timezone"`
	SystemRole string `json:"system_role"`
}

type pendingTermsPayload struct {
	VersionID string             `json:"version_id"`
	Version   int                `json:"version"`
	Locale    string             `json:"locale"`
	Blocks    []domain.TermBlock `json:"blocks"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" || req.Password == "" {
		UnprocessableEntity(w, "email and password are required")
		return
	}

	user, err := h.userRepo.GetByEmail(r.Context(), req.Email)
	if err != nil {
		// Spend comparable time hashing so a missing account can't be
		// distinguished from a wrong password by response latency.
		domain.FakePasswordCheck(req.Password)
		Error(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if !user.CheckPassword(req.Password) {
		Error(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if !user.IsActive {
		Error(w, http.StatusForbidden, "account_inactive")
		return
	}

	tenants, err := h.rbacRepo.GetTenantsForUser(r.Context(), user.ID)
	if err != nil {
		InternalError(w)
		return
	}

	if len(tenants) == 0 {
		pair, err := h.issueBootstrapToken(user)
		if err != nil {
			InternalError(w)
			return
		}
		h.setRefreshCookie(w, pair.RefreshToken)
		JSON(w, http.StatusOK, map[string]any{
			"access_token": pair.AccessToken,
			"expires_at":   pair.ExpiresAt,
			"needs_tenant": true,
			"user":         toUserResponse(user),
		})
		return
	}

	activeTenant := tenants[0]
	pair, claims, err := h.issueTokens(r.Context(), user, activeTenant)
	if err != nil {
		InternalError(w)
		return
	}

	h.setRefreshCookie(w, pair.RefreshToken)

	resp := map[string]any{
		"access_token": pair.AccessToken,
		"expires_at":   pair.ExpiresAt,
		"tenant_id":    claims.TenantID,
		"permissions":  claims.Permissions,
		"tenants":      tenants,
		"user":         toUserResponse(user),
	}
	if pt := h.buildPendingTerms(r.Context(), user); pt != nil {
		resp["pending_terms"] = pt
	}
	JSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(refreshCookieName)
	if err != nil {
		Error(w, http.StatusUnauthorized, "missing refresh token")
		return
	}

	userID, tenantID, tokenVersion, err := h.jwtSvc.ParseRefreshToken(cookie.Value)
	if err != nil {
		h.clearRefreshCookie(w)
		if errors.Is(err, domain.ErrExpired) {
			Error(w, http.StatusUnauthorized, "refresh token expired")
			return
		}
		Error(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	user, err := h.userRepo.GetByID(r.Context(), userID)
	if err != nil {
		h.clearRefreshCookie(w)
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	// Deactivated/disabled accounts must not be able to mint new tokens.
	// Because access tokens are short-lived, refusing refresh here effectively
	// revokes access within one access-token lifetime.
	if !user.IsActive {
		h.clearRefreshCookie(w)
		Error(w, http.StatusForbidden, "account_inactive")
		return
	}
	// Reject refresh tokens revoked by a password change / forced logout.
	if tokenVersion != user.TokenVersion {
		h.clearRefreshCookie(w)
		Error(w, http.StatusUnauthorized, "token revoked")
		return
	}

	// Bootstrap token: re-check if the user now has tenants assigned.
	if tenantID == "" {
		tenants, _ := h.rbacRepo.GetTenantsForUser(r.Context(), user.ID)
		if len(tenants) > 0 {
			tenantID = tenants[0]
		}
	}

	if tenantID == "" {
		pair, err := h.issueBootstrapToken(user)
		if err != nil {
			InternalError(w)
			return
		}
		h.setRefreshCookie(w, pair.RefreshToken)
		JSON(w, http.StatusOK, map[string]any{
			"access_token": pair.AccessToken,
			"expires_at":   pair.ExpiresAt,
			"needs_tenant": true,
			"user":         toUserResponse(user),
		})
		return
	}

	pair, claims, err := h.issueTokens(r.Context(), user, tenantID)
	if err != nil {
		InternalError(w)
		return
	}

	h.setRefreshCookie(w, pair.RefreshToken)

	tenants, _ := h.rbacRepo.GetTenantsForUser(r.Context(), user.ID)
	resp := map[string]any{
		"access_token": pair.AccessToken,
		"expires_at":   pair.ExpiresAt,
		"tenant_id":    claims.TenantID,
		"permissions":  claims.Permissions,
		"tenants":      tenants,
		"user":         toUserResponse(user),
	}
	if pt := h.buildPendingTerms(r.Context(), user); pt != nil {
		resp["pending_terms"] = pt
	}
	JSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	h.clearRefreshCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	if claims == nil {
		Unauthorized(w)
		return
	}

	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil {
		Unauthorized(w)
		return
	}
	if !user.IsActive {
		Error(w, http.StatusForbidden, "account_inactive")
		return
	}

	tenants, _ := h.rbacRepo.GetTenantsForUser(r.Context(), user.ID)

	JSON(w, http.StatusOK, map[string]any{
		"user":        toUserResponse(user),
		"tenant_id":   claims.TenantID,
		"permissions": claims.Permissions,
		"tenants":     tenants,
	})
}

func (h *AuthHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	if claims == nil {
		Unauthorized(w)
		return
	}

	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil {
		Unauthorized(w)
		return
	}

	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Locale   string `json:"locale"`
		Timezone string `json:"timezone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}

	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Locale != "" {
		user.Locale = req.Locale
	}
	if req.Timezone != "" {
		user.Timezone = req.Timezone
	}

	if err := h.userRepo.Update(r.Context(), user); err != nil {
		if errors.Is(err, domain.ErrConflict) {
			Error(w, http.StatusConflict, "email already in use")
			return
		}
		InternalError(w)
		return
	}

	JSON(w, http.StatusOK, map[string]any{"data": toUserResponse(user)})
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	if claims == nil {
		Unauthorized(w)
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		UnprocessableEntity(w, "current_password and new_password are required")
		return
	}
	if len(req.NewPassword) < 8 {
		UnprocessableEntity(w, "new_password must be at least 8 characters")
		return
	}

	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil {
		Unauthorized(w)
		return
	}
	if !user.CheckPassword(req.CurrentPassword) {
		Error(w, http.StatusUnprocessableEntity, "current password is incorrect")
		return
	}
	if err := user.SetPassword(req.NewPassword); err != nil {
		InternalError(w)
		return
	}
	// UpdatePasswordHash also bumps the user's token version, revoking every
	// previously issued token. Re-issue a fresh pair so the caller's current
	// session survives while all other sessions are logged out.
	if err := h.userRepo.UpdatePasswordHash(r.Context(), user.ID, user.PasswordHash); err != nil {
		InternalError(w)
		return
	}

	updated, err := h.userRepo.GetByID(r.Context(), user.ID)
	if err != nil {
		InternalError(w)
		return
	}

	var pair domain.TokenPair
	if claims.TenantID == "" {
		pair, err = h.issueBootstrapToken(updated)
	} else {
		pair, _, err = h.issueTokens(r.Context(), updated, claims.TenantID)
	}
	if err != nil {
		InternalError(w)
		return
	}
	h.setRefreshCookie(w, pair.RefreshToken)
	JSON(w, http.StatusOK, map[string]any{
		"access_token": pair.AccessToken,
		"expires_at":   pair.ExpiresAt,
	})
}

func (h *AuthHandler) issueBootstrapToken(user *domain.User) (domain.TokenPair, error) {
	pair, err := h.jwtSvc.IssueTokenPair(domain.UserClaims{
		UserID:       user.ID,
		SystemRole:   user.SystemRole,
		TenantID:     "",
		Permissions:  []string{"create:tenant", "view-any:tenant"},
		TokenVersion: user.TokenVersion,
	})
	return pair, err
}

func (h *AuthHandler) buildPendingTerms(ctx context.Context, user *domain.User) *pendingTermsPayload {
	if h.legalRepo == nil {
		return nil
	}
	latest, err := h.legalRepo.GetLatestVersion(ctx)
	if err != nil || latest == nil {
		return nil
	}
	accepted, err := h.legalRepo.HasUserAccepted(ctx, user.ID, latest.ID)
	if err != nil || accepted {
		return nil
	}
	locale := user.Locale
	if locale == "" {
		locale = latest.FallbackLocale
	}
	blocks, resolvedLocale := latest.ResolveBlocks(locale)
	return &pendingTermsPayload{
		VersionID: latest.ID,
		Version:   latest.Version,
		Locale:    resolvedLocale,
		Blocks:    blocks,
	}
}

func (h *AuthHandler) AcceptTerms(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	if claims == nil {
		Unauthorized(w)
		return
	}

	var req struct {
		VersionID string `json:"version_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.VersionID == "" {
		UnprocessableEntity(w, "version_id is required")
		return
	}

	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil {
		Unauthorized(w)
		return
	}

	ip := r.Header.Get("X-Real-IP")
	if ip == "" {
		ip = r.RemoteAddr
	}

	if err := h.legalRepo.RecordAcceptance(r.Context(), claims.UserID, req.VersionID, user.Locale, ip); err != nil {
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) issueTokens(ctx context.Context, user *domain.User, tenantID string) (domain.TokenPair, *domain.UserClaims, error) {
	perms, err := h.rbacRepo.GetPermissionsForUser(ctx, user.ID, tenantID)
	if err != nil {
		return domain.TokenPair{}, nil, err
	}
	claims := domain.UserClaims{
		UserID:       user.ID,
		UserName:     user.Name,
		TenantID:     tenantID,
		Permissions:  perms,
		SystemRole:   user.SystemRole,
		TokenVersion: user.TokenVersion,
	}
	pair, err := h.jwtSvc.IssueTokenPair(claims)
	if err != nil {
		return domain.TokenPair{}, nil, err
	}
	return pair, &claims, nil
}

func (h *AuthHandler) setRefreshCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    token,
		Path:     "/auth/refresh",
		Domain:   h.cookieDomain,
		MaxAge:   7 * 24 * 60 * 60,
		HttpOnly: true,
		Secure:   h.secureCookies,
		SameSite: http.SameSiteStrictMode,
	})
}

func (h *AuthHandler) clearRefreshCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     "/auth/refresh",
		Domain:   h.cookieDomain,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.secureCookies,
		SameSite: http.SameSiteStrictMode,
	})
}

func toUserResponse(u *domain.User) userResponse {
	return userResponse{
		ID:         u.ID,
		Name:       u.Name,
		Email:      u.Email,
		Locale:     u.Locale,
		Timezone:   u.Timezone,
		SystemRole: u.SystemRole,
	}
}
