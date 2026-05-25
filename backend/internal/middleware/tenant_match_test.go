package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/stretchr/testify/assert"
)

func withChiParam(r *http.Request, key, val string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, val)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func withClaims(r *http.Request, claims *domain.UserClaims) *http.Request {
	return r.WithContext(withUserClaims(r.Context(), claims))
}

func TestRequireTenantMatch_Match(t *testing.T) {
	t.Parallel()
	h := RequireTenantMatch(okHandler())
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r = withClaims(r, &domain.UserClaims{UserID: "u1", TenantID: "tenant-abc"})
	r = withChiParam(r, "tenantId", "tenant-abc")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequireTenantMatch_Mismatch(t *testing.T) {
	t.Parallel()
	h := RequireTenantMatch(okHandler())
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r = withClaims(r, &domain.UserClaims{UserID: "u1", TenantID: "tenant-abc"})
	r = withChiParam(r, "tenantId", "tenant-xyz")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestRequireTenantMatch_NoParam(t *testing.T) {
	t.Parallel()
	// no chi param → tenantID is "" → condition skipped → passes through
	h := RequireTenantMatch(okHandler())
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r = withClaims(r, &domain.UserClaims{UserID: "u1", TenantID: "tenant-abc"})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequireTenantMatch_NoClaims(t *testing.T) {
	t.Parallel()
	h := RequireTenantMatch(okHandler())
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r = withChiParam(r, "tenantId", "tenant-abc")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireTenantMatch_SuperAdminBypass(t *testing.T) {
	t.Parallel()
	// view-any:tenant permission bypasses the tenant ID check
	h := RequireTenantMatch(okHandler())
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r = withClaims(r, &domain.UserClaims{
		UserID:      "admin",
		TenantID:    "tenant-admin",
		Permissions: []string{"view-any:tenant"},
	})
	r = withChiParam(r, "tenantId", "tenant-other")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusOK, w.Code)
}
