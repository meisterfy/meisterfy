package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testJWTSecret = "super-secret-test-key-for-middleware"

func newTestJWT() *domain.JWTService {
	return domain.NewJWTService(testJWTSecret)
}

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func issueTestToken(t *testing.T, svc *domain.JWTService, claims domain.UserClaims) string {
	t.Helper()
	pair, err := svc.IssueTokenPair(claims)
	require.NoError(t, err)
	return pair.AccessToken
}

// mirrors domain.accessClaims for creating out-of-band test tokens
type testJWTClaims struct {
	jwt.RegisteredClaims
	TenantID    string   `json:"tid"`
	Permissions []string `json:"perms"`
	UserName    string   `json:"uname,omitempty"`
}

func issueExpiredTestToken(t *testing.T, claims domain.UserClaims) string {
	t.Helper()
	past := time.Now().Add(-2 * time.Minute)
	ac := testJWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   claims.UserID,
			Issuer:    "rush-maestro",
			Audience:  jwt.ClaimStrings{"rush-maestro-api"},
			IssuedAt:  jwt.NewNumericDate(past.Add(-15 * time.Minute)),
			ExpiresAt: jwt.NewNumericDate(past),
		},
		TenantID:    claims.TenantID,
		Permissions: claims.Permissions,
		UserName:    claims.UserName,
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, ac).SignedString([]byte(testJWTSecret))
	require.NoError(t, err)
	return tok
}

func TestAuthenticateAdmin_NoAuthorizationHeader(t *testing.T) {
	t.Parallel()
	h := AuthenticateAdmin(newTestJWT())(okHandler())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthenticateAdmin_MalformedBearer(t *testing.T) {
	t.Parallel()
	h := AuthenticateAdmin(newTestJWT())(okHandler())
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer") // no token after prefix
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthenticateAdmin_InvalidToken(t *testing.T) {
	t.Parallel()
	h := AuthenticateAdmin(newTestJWT())(okHandler())
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer not.a.valid.jwt")
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthenticateAdmin_ExpiredToken(t *testing.T) {
	t.Parallel()
	h := AuthenticateAdmin(newTestJWT())(okHandler())
	tok := issueExpiredTestToken(t, domain.UserClaims{UserID: "u1", TenantID: "t1"})
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer "+tok)
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthenticateAdmin_ValidToken(t *testing.T) {
	t.Parallel()
	svc := newTestJWT()
	h := AuthenticateAdmin(svc)(okHandler())
	tok := issueTestToken(t, svc, domain.UserClaims{UserID: "u1", TenantID: "t1"})
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer "+tok)
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAuthenticateAdmin_ClaimsStoredInContext(t *testing.T) {
	t.Parallel()
	svc := newTestJWT()
	var got *domain.UserClaims
	capture := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = UserClaimsFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	})
	h := AuthenticateAdmin(svc)(capture)

	want := domain.UserClaims{
		UserID:      "u1",
		TenantID:    "t1",
		Permissions: []string{"read:posts", "write:posts"},
	}
	tok := issueTestToken(t, svc, want)
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer "+tok)
	h.ServeHTTP(w, r)

	require.NotNil(t, got)
	assert.Equal(t, want.UserID, got.UserID)
	assert.Equal(t, want.TenantID, got.TenantID)
	assert.Equal(t, want.Permissions, got.Permissions)
}

func TestRequirePermission_NoClaims(t *testing.T) {
	t.Parallel()
	h := RequirePermission("read:posts")(okHandler())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequirePermission_HasPermission(t *testing.T) {
	t.Parallel()
	svc := newTestJWT()
	h := AuthenticateAdmin(svc)(RequirePermission("read:posts")(okHandler()))
	tok := issueTestToken(t, svc, domain.UserClaims{
		UserID: "u1", TenantID: "t1", Permissions: []string{"read:posts"},
	})
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer "+tok)
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequirePermission_MissingPermission(t *testing.T) {
	t.Parallel()
	svc := newTestJWT()
	h := AuthenticateAdmin(svc)(RequirePermission("admin:all")(okHandler()))
	tok := issueTestToken(t, svc, domain.UserClaims{
		UserID: "u1", TenantID: "t1", Permissions: []string{"read:posts"},
	})
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer "+tok)
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusForbidden, w.Code)
}
