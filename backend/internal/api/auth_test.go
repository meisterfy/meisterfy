package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/meisterfy/meisterfy/internal/domain"
	mw "github.com/meisterfy/meisterfy/internal/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

// --- mocks ---

type mockAuthUserRepo struct {
	user      *domain.User
	getErr    error
	updateErr error
}

func (m *mockAuthUserRepo) GetByEmail(_ context.Context, _ string) (*domain.User, error) {
	return m.user, m.getErr
}
func (m *mockAuthUserRepo) GetByID(_ context.Context, _ string) (*domain.User, error) {
	return m.user, m.getErr
}
func (m *mockAuthUserRepo) Update(_ context.Context, _ *domain.User) error {
	return m.updateErr
}
func (m *mockAuthUserRepo) UpdatePasswordHash(_ context.Context, _, _ string) error {
	return m.updateErr
}

type mockRBACRepo struct {
	tenants    []string
	perms      []string
	tenantsErr error
	permsErr   error
}

func (m *mockRBACRepo) GetTenantsForUser(_ context.Context, _ string) ([]string, error) {
	return m.tenants, m.tenantsErr
}
func (m *mockRBACRepo) GetPermissionsForUser(_ context.Context, _, _ string) ([]string, error) {
	return m.perms, m.permsErr
}

type mockLegalRepo struct{}

func (m *mockLegalRepo) GetLatestVersion(_ context.Context) (*domain.LegalTermVersion, error) {
	return nil, nil
}
func (m *mockLegalRepo) HasUserAccepted(_ context.Context, _, _ string) (bool, error) {
	return true, nil
}
func (m *mockLegalRepo) RecordAcceptance(_ context.Context, _, _, _, _ string) error {
	return nil
}

// --- helpers ---

// testPassword / testPasswordHash computed once at MinCost to keep tests fast.
const testPassword = "test-password-1234"

var testPasswordHash = func() string {
	h, _ := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.MinCost)
	return string(h)
}()

func newTestUser() *domain.User {
	return &domain.User{
		ID:           "user-1",
		Email:        "alice@example.com",
		Name:         "Alice",
		PasswordHash: testPasswordHash,
		IsActive:     true,
	}
}

func newAuthHandler(u *mockAuthUserRepo, r *mockRBACRepo) *AuthHandler {
	return NewAuthHandler(u, r, &mockLegalRepo{}, newTestJWT(), "localhost", false)
}

// issueExpiredRefreshCookie sets a cookie with an expired refresh token on r.
func issueExpiredRefreshCookie(t *testing.T, r *http.Request, userID, tenantID string) {
	t.Helper()
	past := time.Now().Add(-2 * time.Minute)
	type rc struct {
		jwt.RegisteredClaims
		TenantID string `json:"tid"`
	}
	claims := rc{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(past.Add(-7 * 24 * time.Hour)),
			ExpiresAt: jwt.NewNumericDate(past),
		},
		TenantID: tenantID,
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testAPISecret))
	require.NoError(t, err)
	r.AddCookie(&http.Cookie{Name: refreshCookieName, Value: tok})
}

// --- Login tests ---

func TestAuthHandler_Login_Success(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(
		&mockAuthUserRepo{user: newTestUser()},
		&mockRBACRepo{tenants: []string{"tenant-1"}, perms: []string{"read:posts"}},
	)

	body := jsonBody(map[string]string{"email": "alice@example.com", "password": testPassword})
	w := httptest.NewRecorder()
	h.Login(w, httptest.NewRequest(http.MethodPost, "/auth/login", body))

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["access_token"])
	assert.Equal(t, "tenant-1", resp["tenant_id"])
}

func TestAuthHandler_Login_NoTenants_Bootstrap(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(
		&mockAuthUserRepo{user: newTestUser()},
		&mockRBACRepo{tenants: []string{}},
	)

	body := jsonBody(map[string]string{"email": "alice@example.com", "password": testPassword})
	w := httptest.NewRecorder()
	h.Login(w, httptest.NewRequest(http.MethodPost, "/auth/login", body))

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["access_token"])
	assert.Equal(t, true, resp["needs_tenant"])
}

func TestAuthHandler_Login_WrongPassword(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(&mockAuthUserRepo{user: newTestUser()}, &mockRBACRepo{})

	body := jsonBody(map[string]string{"email": "alice@example.com", "password": "wrong-password"})
	w := httptest.NewRecorder()
	h.Login(w, httptest.NewRequest(http.MethodPost, "/auth/login", body))

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthHandler_Login_UserNotFound(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(&mockAuthUserRepo{user: nil, getErr: domain.ErrNotFound}, &mockRBACRepo{})

	body := jsonBody(map[string]string{"email": "ghost@example.com", "password": "anything"})
	w := httptest.NewRecorder()
	h.Login(w, httptest.NewRequest(http.MethodPost, "/auth/login", body))

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthHandler_Login_InvalidJSON(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(&mockAuthUserRepo{}, &mockRBACRepo{})

	w := httptest.NewRecorder()
	h.Login(w, httptest.NewRequest(http.MethodPost, "/auth/login", jsonBody("not-an-object")))

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAuthHandler_Login_MissingFields(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(&mockAuthUserRepo{user: newTestUser()}, &mockRBACRepo{})

	cases := []struct {
		name string
		body map[string]string
	}{
		{"missing email", map[string]string{"password": testPassword}},
		{"missing password", map[string]string{"email": "alice@example.com"}},
		{"both empty", map[string]string{}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			w := httptest.NewRecorder()
			h.Login(w, httptest.NewRequest(http.MethodPost, "/auth/login", jsonBody(tc.body)))
			assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		})
	}
}

func TestAuthHandler_Login_InactiveUser(t *testing.T) {
	t.Parallel()
	user := newTestUser()
	user.IsActive = false
	h := newAuthHandler(&mockAuthUserRepo{user: user}, &mockRBACRepo{})

	body := jsonBody(map[string]string{"email": "alice@example.com", "password": testPassword})
	w := httptest.NewRecorder()
	h.Login(w, httptest.NewRequest(http.MethodPost, "/auth/login", body))

	assert.Equal(t, http.StatusForbidden, w.Code)
}

// --- Logout tests ---

func TestAuthHandler_Logout_ClearsCookie(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(&mockAuthUserRepo{}, &mockRBACRepo{})

	w := httptest.NewRecorder()
	h.Logout(w, httptest.NewRequest(http.MethodPost, "/auth/logout", nil))

	assert.Equal(t, http.StatusNoContent, w.Code)
}

// --- Refresh tests ---

func TestAuthHandler_Refresh_NoCookie(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(&mockAuthUserRepo{}, &mockRBACRepo{})

	w := httptest.NewRecorder()
	h.Refresh(w, httptest.NewRequest(http.MethodPost, "/auth/refresh", nil))

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthHandler_Refresh_InvalidToken(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(&mockAuthUserRepo{}, &mockRBACRepo{})

	r := httptest.NewRequest(http.MethodPost, "/auth/refresh", nil)
	r.AddCookie(&http.Cookie{Name: refreshCookieName, Value: "garbage.token.value"})
	w := httptest.NewRecorder()
	h.Refresh(w, r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthHandler_Refresh_ExpiredToken(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(&mockAuthUserRepo{}, &mockRBACRepo{})

	r := httptest.NewRequest(http.MethodPost, "/auth/refresh", nil)
	issueExpiredRefreshCookie(t, r, "u1", "t1")
	w := httptest.NewRecorder()
	h.Refresh(w, r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthHandler_Refresh_UserNotFound(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	h := NewAuthHandler(
		&mockAuthUserRepo{user: nil, getErr: domain.ErrNotFound},
		&mockRBACRepo{},
		&mockLegalRepo{},
		jwtSvc, "localhost", false,
	)

	pair, err := jwtSvc.IssueTokenPair(domain.UserClaims{UserID: "u1", TenantID: "t1"})
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodPost, "/auth/refresh", nil)
	r.AddCookie(&http.Cookie{Name: refreshCookieName, Value: pair.RefreshToken})
	w := httptest.NewRecorder()
	h.Refresh(w, r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthHandler_Refresh_InactiveUser(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser()
	user.IsActive = false
	h := NewAuthHandler(
		&mockAuthUserRepo{user: user},
		&mockRBACRepo{tenants: []string{"tenant-1"}, perms: []string{"read:posts"}},
		&mockLegalRepo{},
		jwtSvc, "localhost", false,
	)

	pair, err := jwtSvc.IssueTokenPair(domain.UserClaims{UserID: user.ID, TenantID: "tenant-1"})
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodPost, "/auth/refresh", nil)
	r.AddCookie(&http.Cookie{Name: refreshCookieName, Value: pair.RefreshToken})
	w := httptest.NewRecorder()
	h.Refresh(w, r)

	// A deactivated account must not be able to refresh into new tokens.
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestAuthHandler_Refresh_StaleTokenVersion(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser() // TokenVersion == 0
	h := NewAuthHandler(
		&mockAuthUserRepo{user: user},
		&mockRBACRepo{tenants: []string{"tenant-1"}, perms: []string{"read:posts"}},
		&mockLegalRepo{},
		jwtSvc, "localhost", false,
	)

	// Refresh token carries an old version (5) that no longer matches the user.
	pair, err := jwtSvc.IssueTokenPair(domain.UserClaims{UserID: user.ID, TenantID: "tenant-1", TokenVersion: 5})
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodPost, "/auth/refresh", nil)
	r.AddCookie(&http.Cookie{Name: refreshCookieName, Value: pair.RefreshToken})
	w := httptest.NewRecorder()
	h.Refresh(w, r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthHandler_Refresh_Bootstrap_NoTenants(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser()
	h := NewAuthHandler(
		&mockAuthUserRepo{user: user},
		&mockRBACRepo{tenants: []string{}}, // still no tenants after refresh
		&mockLegalRepo{},
		jwtSvc, "localhost", false,
	)

	// Bootstrap refresh token has empty TenantID
	pair, err := jwtSvc.IssueTokenPair(domain.UserClaims{UserID: user.ID, TenantID: ""})
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodPost, "/auth/refresh", nil)
	r.AddCookie(&http.Cookie{Name: refreshCookieName, Value: pair.RefreshToken})
	w := httptest.NewRecorder()
	h.Refresh(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, true, resp["needs_tenant"])
}

func TestAuthHandler_Refresh_Bootstrap_NowHasTenant(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser()
	h := NewAuthHandler(
		&mockAuthUserRepo{user: user},
		&mockRBACRepo{tenants: []string{"tenant-1"}, perms: []string{"read:posts"}},
		&mockLegalRepo{},
		jwtSvc, "localhost", false,
	)

	// Bootstrap refresh token (empty TenantID) but user now has a tenant
	pair, err := jwtSvc.IssueTokenPair(domain.UserClaims{UserID: user.ID, TenantID: ""})
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodPost, "/auth/refresh", nil)
	r.AddCookie(&http.Cookie{Name: refreshCookieName, Value: pair.RefreshToken})
	w := httptest.NewRecorder()
	h.Refresh(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["access_token"])
	assert.Equal(t, "tenant-1", resp["tenant_id"])
}

func TestAuthHandler_Refresh_ValidToken(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser()
	h := NewAuthHandler(
		&mockAuthUserRepo{user: user},
		&mockRBACRepo{tenants: []string{"tenant-1"}, perms: []string{"read:posts"}},
		&mockLegalRepo{},
		jwtSvc, "localhost", false,
	)

	pair, err := jwtSvc.IssueTokenPair(domain.UserClaims{UserID: user.ID, TenantID: "tenant-1"})
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodPost, "/auth/refresh", nil)
	r.AddCookie(&http.Cookie{Name: refreshCookieName, Value: pair.RefreshToken})
	w := httptest.NewRecorder()
	h.Refresh(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["access_token"])
}

// --- Me tests ---

func TestAuthHandler_Me_NoClaims(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(&mockAuthUserRepo{user: newTestUser()}, &mockRBACRepo{})

	w := httptest.NewRecorder()
	h.Me(w, httptest.NewRequest(http.MethodGet, "/auth/me", nil))

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthHandler_Me_Success(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser()
	h := NewAuthHandler(
		&mockAuthUserRepo{user: user},
		&mockRBACRepo{tenants: []string{"tenant-1"}},
		&mockLegalRepo{},
		jwtSvc, "localhost", false,
	)

	tok := issueTestToken(t, jwtSvc, domain.UserClaims{UserID: user.ID, TenantID: "tenant-1"})
	wrapped := mw.AuthenticateAdmin(jwtSvc)(http.HandlerFunc(h.Me))

	r := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	r.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotNil(t, resp["user"])
}

// --- UpdateMe tests ---

func TestAuthHandler_UpdateMe_NoClaims(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(&mockAuthUserRepo{user: newTestUser()}, &mockRBACRepo{})

	body := jsonBody(map[string]string{"name": "New Name"})
	w := httptest.NewRecorder()
	h.UpdateMe(w, httptest.NewRequest(http.MethodPatch, "/auth/me", body))

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthHandler_UpdateMe_Success(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser()
	h := NewAuthHandler(&mockAuthUserRepo{user: user}, &mockRBACRepo{}, &mockLegalRepo{}, jwtSvc, "localhost", false)
	tok := issueTestToken(t, jwtSvc, domain.UserClaims{UserID: user.ID, TenantID: "t1"})
	wrapped := mw.AuthenticateAdmin(jwtSvc)(http.HandlerFunc(h.UpdateMe))

	body := jsonBody(map[string]string{"name": "New Name", "locale": "pt-BR"})
	r := httptest.NewRequest(http.MethodPatch, "/auth/me", body)
	r.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotNil(t, resp["data"])
}

func TestAuthHandler_UpdateMe_ConflictEmail(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser()
	h := NewAuthHandler(
		&mockAuthUserRepo{user: user, updateErr: domain.ErrConflict},
		&mockRBACRepo{}, &mockLegalRepo{}, jwtSvc, "localhost", false,
	)
	tok := issueTestToken(t, jwtSvc, domain.UserClaims{UserID: user.ID})
	wrapped := mw.AuthenticateAdmin(jwtSvc)(http.HandlerFunc(h.UpdateMe))

	body := jsonBody(map[string]string{"email": "taken@example.com"})
	r := httptest.NewRequest(http.MethodPatch, "/auth/me", body)
	r.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, r)

	assert.Equal(t, http.StatusConflict, w.Code)
}

// --- ChangePassword tests ---

func TestAuthHandler_ChangePassword_NoClaims(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(&mockAuthUserRepo{}, &mockRBACRepo{})

	body := jsonBody(map[string]string{"current_password": "old", "new_password": "newpass123"})
	w := httptest.NewRecorder()
	h.ChangePassword(w, httptest.NewRequest(http.MethodPost, "/auth/change-password", body))

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthHandler_ChangePassword_MissingFields(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser()
	h := NewAuthHandler(&mockAuthUserRepo{user: user}, &mockRBACRepo{}, &mockLegalRepo{}, jwtSvc, "localhost", false)
	tok := issueTestToken(t, jwtSvc, domain.UserClaims{UserID: user.ID})
	wrapped := mw.AuthenticateAdmin(jwtSvc)(http.HandlerFunc(h.ChangePassword))

	body := jsonBody(map[string]string{"current_password": "old"}) // missing new_password
	r := httptest.NewRequest(http.MethodPost, "/auth/change-password", body)
	r.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAuthHandler_ChangePassword_TooShort(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser()
	h := NewAuthHandler(&mockAuthUserRepo{user: user}, &mockRBACRepo{}, &mockLegalRepo{}, jwtSvc, "localhost", false)
	tok := issueTestToken(t, jwtSvc, domain.UserClaims{UserID: user.ID})
	wrapped := mw.AuthenticateAdmin(jwtSvc)(http.HandlerFunc(h.ChangePassword))

	body := jsonBody(map[string]string{"current_password": testPassword, "new_password": "short"})
	r := httptest.NewRequest(http.MethodPost, "/auth/change-password", body)
	r.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAuthHandler_ChangePassword_Success_ReissuesToken(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser()
	h := NewAuthHandler(
		&mockAuthUserRepo{user: user},
		&mockRBACRepo{tenants: []string{"tenant-1"}, perms: []string{"read:posts"}},
		&mockLegalRepo{}, jwtSvc, "localhost", false,
	)
	tok := issueTestToken(t, jwtSvc, domain.UserClaims{UserID: user.ID, TenantID: "tenant-1"})
	wrapped := mw.AuthenticateAdmin(jwtSvc)(http.HandlerFunc(h.ChangePassword))

	body := jsonBody(map[string]string{"current_password": testPassword, "new_password": "new-password-123"})
	r := httptest.NewRequest(http.MethodPost, "/auth/change-password", body)
	r.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, r)

	// Password change returns a fresh token pair so the current session survives.
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["access_token"])

	var refreshed bool
	for _, c := range w.Result().Cookies() {
		if c.Name == refreshCookieName && c.Value != "" {
			refreshed = true
		}
	}
	assert.True(t, refreshed, "a new refresh cookie should be set")
}

func TestAuthHandler_ChangePassword_WrongCurrent(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	user := newTestUser()
	h := NewAuthHandler(&mockAuthUserRepo{user: user}, &mockRBACRepo{}, &mockLegalRepo{}, jwtSvc, "localhost", false)
	tok := issueTestToken(t, jwtSvc, domain.UserClaims{UserID: user.ID})
	wrapped := mw.AuthenticateAdmin(jwtSvc)(http.HandlerFunc(h.ChangePassword))

	body := jsonBody(map[string]string{"current_password": "wrong-old-pass", "new_password": "new-password-123"})
	r := httptest.NewRequest(http.MethodPost, "/auth/change-password", body)
	r.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}
