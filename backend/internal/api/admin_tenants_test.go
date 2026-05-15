package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rush-maestro/rush-maestro/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- mocks ---

type mockTenantRepo struct {
	tenants   []*domain.Tenant
	tenant    *domain.Tenant
	listErr   error
	getErr    error
	createErr error
	updateErr error
	deleteErr error
}

func (m *mockTenantRepo) List(_ context.Context) ([]*domain.Tenant, error) {
	return m.tenants, m.listErr
}
func (m *mockTenantRepo) GetByID(_ context.Context, _ string) (*domain.Tenant, error) {
	return m.tenant, m.getErr
}
func (m *mockTenantRepo) Create(_ context.Context, _ *domain.Tenant) error {
	return m.createErr
}
func (m *mockTenantRepo) Update(_ context.Context, _ *domain.Tenant) error {
	return m.updateErr
}
func (m *mockTenantRepo) Delete(_ context.Context, _ string) error {
	return m.deleteErr
}

type mockTenantRBACRepo struct {
	assignErr error
	calls     int
}

func (m *mockTenantRBACRepo) AssignRole(_ context.Context, _, _, _ string) error {
	m.calls++
	return m.assignErr
}

type capturingAudit struct {
	entries []domain.AuditEntry
}

func (m *capturingAudit) Log(_ context.Context, _ domain.AuditEntry) error { return nil }
func (m *capturingAudit) List(_ context.Context, _ domain.AuditLogFilter) ([]*domain.AuditEntry, int64, error) {
	return nil, 0, nil
}
func (m *capturingAudit) AsyncLog(e domain.AuditEntry) { m.entries = append(m.entries, e) }

// --- helpers ---

func sampleTenant() *domain.Tenant {
	return &domain.Tenant{
		ID:       "tenant-1",
		Name:     "Acme Corp",
		Language: "pt_BR",
		Hashtags: []string{},
	}
}

func newTenantsHandler(repo *mockTenantRepo, rbac *mockTenantRBACRepo, audit AuditLogRepo) *AdminTenantsHandler {
	if rbac == nil {
		rbac = &mockTenantRBACRepo{}
	}
	if audit == nil {
		audit = &mockAudit{}
	}
	return NewAdminTenantsHandler(repo, rbac, audit)
}

func defaultClaims() domain.UserClaims {
	return domain.UserClaims{
		UserID:   "user-1",
		UserName: "Alice",
		TenantID: "tenant-1",
	}
}

// --- List tests ---

func TestAdminTenants_List(t *testing.T) {
	t.Parallel()
	tenants := []*domain.Tenant{sampleTenant()}
	h := newTenantsHandler(&mockTenantRepo{tenants: tenants}, nil, nil)

	w := httptest.NewRecorder()
	h.List(w, httptest.NewRequest(http.MethodGet, "/", nil))

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].([]any)
	assert.Len(t, data, 1)
}

func TestAdminTenants_List_Empty(t *testing.T) {
	t.Parallel()
	h := newTenantsHandler(&mockTenantRepo{tenants: []*domain.Tenant{}}, nil, nil)

	w := httptest.NewRecorder()
	h.List(w, httptest.NewRequest(http.MethodGet, "/", nil))

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].([]any)
	assert.Empty(t, data)
}

// --- Get tests ---

func TestAdminTenants_Get_Found(t *testing.T) {
	t.Parallel()
	h := newTenantsHandler(&mockTenantRepo{tenant: sampleTenant()}, nil, nil)

	r := withChiParam(httptest.NewRequest(http.MethodGet, "/", nil), "tenantId", "tenant-1")
	w := httptest.NewRecorder()
	h.Get(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotNil(t, resp["data"])
}

func TestAdminTenants_Get_NotFound(t *testing.T) {
	t.Parallel()
	h := newTenantsHandler(&mockTenantRepo{getErr: domain.ErrNotFound}, nil, nil)

	r := withChiParam(httptest.NewRequest(http.MethodGet, "/", nil), "tenantId", "missing")
	w := httptest.NewRecorder()
	h.Get(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// --- Create tests ---

func TestAdminTenants_Create_Valid(t *testing.T) {
	t.Parallel()
	audit := &capturingAudit{}
	rbac := &mockTenantRBACRepo{}
	repo := &mockTenantRepo{tenant: sampleTenant()}
	h := newTenantsHandler(repo, rbac, audit)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPost, "/", map[string]any{
		"id": "tenant-1", "name": "Acme Corp",
	})
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Create).ServeHTTP(w, r)

	require.Equal(t, http.StatusCreated, w.Code)
	assert.Equal(t, 1, rbac.calls, "rbacRepo.AssignRole should have been called")
	require.Len(t, audit.entries, 1)
	assert.Equal(t, "tenant.created", audit.entries[0].Action)
}

func TestAdminTenants_Create_DuplicateID(t *testing.T) {
	t.Parallel()
	repo := &mockTenantRepo{createErr: domain.ErrConflict}
	h := newTenantsHandler(repo, nil, nil)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPost, "/", map[string]any{
		"id": "tenant-1", "name": "Acme Corp",
	})
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Create).ServeHTTP(w, r)

	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestAdminTenants_Create_MissingRequired(t *testing.T) {
	t.Parallel()
	h := newTenantsHandler(&mockTenantRepo{}, nil, nil)

	cases := []struct {
		name string
		body map[string]any
	}{
		{"missing id", map[string]any{"name": "Acme Corp"}},
		{"missing name", map[string]any{"id": "tenant-1"}},
		{"missing both", map[string]any{}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPost, "/", tc.body)
			w := httptest.NewRecorder()
			wrapAuth(jwtSvc, h.Create).ServeHTTP(w, r)
			assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		})
	}
}

// --- Update tests ---

func TestAdminTenants_Update_Valid(t *testing.T) {
	t.Parallel()
	audit := &capturingAudit{}
	repo := &mockTenantRepo{tenant: sampleTenant()}
	h := newTenantsHandler(repo, nil, audit)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{
		"name": "Acme Corp Updated",
	})
	r = withChiParam(r, "tenantId", "tenant-1")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Update).ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	require.Len(t, audit.entries, 1)
	assert.Equal(t, "tenant.updated", audit.entries[0].Action)
}

func TestAdminTenants_Update_NotFound(t *testing.T) {
	t.Parallel()
	h := newTenantsHandler(&mockTenantRepo{getErr: domain.ErrNotFound}, nil, nil)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{"name": "X"})
	r = withChiParam(r, "tenantId", "missing")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Update).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminTenants_Update_InvalidJSON(t *testing.T) {
	t.Parallel()
	h := newTenantsHandler(&mockTenantRepo{tenant: sampleTenant()}, nil, nil)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", "not-an-object")
	r = withChiParam(r, "tenantId", "tenant-1")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Update).ServeHTTP(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminTenants_Update_InternalError(t *testing.T) {
	t.Parallel()
	h := newTenantsHandler(&mockTenantRepo{tenant: sampleTenant(), updateErr: errInternal}, nil, nil)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{"name": "X"})
	r = withChiParam(r, "tenantId", "tenant-1")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Update).ServeHTTP(w, r)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// --- Delete tests ---

// errInternal is a generic non-domain error for internal-error path testing.
var errInternal = errors.New("database unavailable")

func TestAdminTenants_Delete_Valid(t *testing.T) {
	t.Parallel()
	audit := &capturingAudit{}
	repo := &mockTenantRepo{tenant: sampleTenant()}
	h := newTenantsHandler(repo, nil, audit)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodDelete, "/", nil)
	r = withChiParam(r, "tenantId", "tenant-1")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Delete).ServeHTTP(w, r)

	require.Equal(t, http.StatusNoContent, w.Code)
	require.Len(t, audit.entries, 1)
	assert.Equal(t, "tenant.deleted", audit.entries[0].Action)
}

func TestAdminTenants_Delete_NotFound(t *testing.T) {
	t.Parallel()
	h := newTenantsHandler(&mockTenantRepo{deleteErr: domain.ErrNotFound}, nil, nil)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodDelete, "/", nil)
	r = withChiParam(r, "tenantId", "missing")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Delete).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminTenants_Update_AllFields(t *testing.T) {
	t.Parallel()
	niche := "tech"
	loc := "BR"
	h := newTenantsHandler(&mockTenantRepo{tenant: sampleTenant()}, nil, nil)

	body := map[string]any{
		"name":     "Updated Name",
		"language": "en_US",
		"niche":    niche,
		"location": loc,
		"hashtags": []string{"#go"},
	}
	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", body)
	r = withChiParam(r, "tenantId", "tenant-1")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Update).ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
}
