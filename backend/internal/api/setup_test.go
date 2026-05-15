package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- mocks ---

type mockSetupUserRepo struct {
	userCount int64
	countErr  error
	createErr error
}

func (m *mockSetupUserRepo) Count(_ context.Context) (int64, error) {
	return m.userCount, m.countErr
}
func (m *mockSetupUserRepo) Create(_ context.Context, _ *domain.User) error {
	return m.createErr
}

type mockSetupTenantRepo struct {
	tenants []*domain.Tenant
	listErr error
}

func (m *mockSetupTenantRepo) List(_ context.Context) ([]*domain.Tenant, error) {
	return m.tenants, m.listErr
}

type mockSetupRBACRepo struct {
	assignErr error
	perms     []string
	permsErr  error
}

func (m *mockSetupRBACRepo) AssignRole(_ context.Context, _, _, _ string) error {
	return m.assignErr
}
func (m *mockSetupRBACRepo) GetPermissionsForUser(_ context.Context, _, _ string) ([]string, error) {
	return m.perms, m.permsErr
}

// --- helpers ---

func newSetupHandler(userRepo *mockSetupUserRepo, tenantRepo *mockSetupTenantRepo, rbac *mockSetupRBACRepo) *SetupHandler {
	if tenantRepo == nil {
		tenantRepo = &mockSetupTenantRepo{}
	}
	if rbac == nil {
		rbac = &mockSetupRBACRepo{}
	}
	return NewSetupHandler(userRepo, tenantRepo, rbac, newTestJWT(), "localhost", false)
}

func validSetupBody() map[string]any {
	return map[string]any{
		"name":     "Admin",
		"email":    "admin@example.com",
		"password": "securepass1",
	}
}

// --- Tests ---

func TestSetup_FirstUser_Succeeds(t *testing.T) {
	t.Parallel()
	// userCount=0 means setup not done yet → 201
	h := newSetupHandler(
		&mockSetupUserRepo{userCount: 0},
		&mockSetupTenantRepo{tenants: []*domain.Tenant{}},
		&mockSetupRBACRepo{perms: []string{"create:tenant"}},
	)

	w := httptest.NewRecorder()
	h.Create(w, httptest.NewRequest(http.MethodPost, "/setup", jsonBody(validSetupBody())))

	require.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["access_token"])
	assert.Equal(t, true, resp["needs_tenant"])
}

func TestSetup_FirstUser_WithTenant_Succeeds(t *testing.T) {
	t.Parallel()
	// userCount=0 and tenant exists → issues token for that tenant
	h := newSetupHandler(
		&mockSetupUserRepo{userCount: 0},
		&mockSetupTenantRepo{tenants: []*domain.Tenant{{ID: "t1", Name: "Acme"}}},
		&mockSetupRBACRepo{perms: []string{"manage:all"}},
	)

	w := httptest.NewRecorder()
	h.Create(w, httptest.NewRequest(http.MethodPost, "/setup", jsonBody(validSetupBody())))

	require.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["access_token"])
	// needs_tenant should be absent or false when tenant exists
	assert.NotEqual(t, true, resp["needs_tenant"])
}

func TestSetup_AlreadySetup_Locked(t *testing.T) {
	t.Parallel()
	// userCount=1 → setup is locked → 404
	h := newSetupHandler(&mockSetupUserRepo{userCount: 1}, nil, nil)

	w := httptest.NewRecorder()
	h.Create(w, httptest.NewRequest(http.MethodPost, "/setup", jsonBody(validSetupBody())))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestSetup_MissingName(t *testing.T) {
	t.Parallel()
	h := newSetupHandler(&mockSetupUserRepo{userCount: 0}, nil, nil)

	body := map[string]any{"email": "admin@example.com", "password": "securepass1"}
	w := httptest.NewRecorder()
	h.Create(w, httptest.NewRequest(http.MethodPost, "/setup", jsonBody(body)))

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestSetup_MissingEmail(t *testing.T) {
	t.Parallel()
	h := newSetupHandler(&mockSetupUserRepo{userCount: 0}, nil, nil)

	body := map[string]any{"name": "Admin", "password": "securepass1"}
	w := httptest.NewRecorder()
	h.Create(w, httptest.NewRequest(http.MethodPost, "/setup", jsonBody(body)))

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestSetup_WeakPassword(t *testing.T) {
	t.Parallel()
	h := newSetupHandler(&mockSetupUserRepo{userCount: 0}, nil, nil)

	body := map[string]any{"name": "Admin", "email": "admin@example.com", "password": "short"}
	w := httptest.NewRecorder()
	h.Create(w, httptest.NewRequest(http.MethodPost, "/setup", jsonBody(body)))

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestSetup_InvalidJSON(t *testing.T) {
	t.Parallel()
	h := newSetupHandler(&mockSetupUserRepo{userCount: 0}, nil, nil)

	w := httptest.NewRecorder()
	h.Create(w, httptest.NewRequest(http.MethodPost, "/setup", jsonBody("not-an-object")))

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}
