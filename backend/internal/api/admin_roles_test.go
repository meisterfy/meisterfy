package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- mock ---

type mockRolesRepo struct {
	roles          []domain.Role
	role           *domain.Role
	perms          []domain.Permission
	listErr        error
	getErr         error
	createErr      error
	deleteErr      error
	setPermsErr    error
	listPermsErr   error
}

func (m *mockRolesRepo) ListRoles(_ context.Context, _ string) ([]domain.Role, error) {
	return m.roles, m.listErr
}
func (m *mockRolesRepo) GetRoleByID(_ context.Context, _ string) (*domain.Role, error) {
	return m.role, m.getErr
}
func (m *mockRolesRepo) CreateRole(_ context.Context, _ *domain.Role) error {
	return m.createErr
}
func (m *mockRolesRepo) UpdateRole(_ context.Context, _ string, _ string) error {
	return nil
}
func (m *mockRolesRepo) DeleteRole(_ context.Context, _ string) error {
	return m.deleteErr
}
func (m *mockRolesRepo) SetRolePermissions(_ context.Context, _ string, _ []string) error {
	return m.setPermsErr
}
func (m *mockRolesRepo) ListPermissions(_ context.Context) ([]domain.Permission, error) {
	return m.perms, m.listPermsErr
}

// --- helpers ---

func sampleRoleFull() domain.Role {
	tid := "tenant-1"
	return domain.Role{
		ID:          "role-custom",
		Name:        "Custom",
		TenantID:    &tid,
		Permissions: []string{"read:posts"},
	}
}

func newRolesHandler(repo *mockRolesRepo) *AdminRolesHandler {
	return NewAdminRolesHandler(repo)
}

// --- List tests ---

func TestAdminRoles_List(t *testing.T) {
	t.Parallel()
	h := newRolesHandler(&mockRolesRepo{roles: []domain.Role{sampleRoleFull()}})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.List).ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].([]any)
	assert.Len(t, data, 1)
}

func TestAdminRoles_List_Empty(t *testing.T) {
	t.Parallel()
	h := newRolesHandler(&mockRolesRepo{roles: []domain.Role{}})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.List).ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Empty(t, resp["data"].([]any))
}

// --- Get tests ---

func TestAdminRoles_Get_Found(t *testing.T) {
	t.Parallel()
	role := sampleRoleFull() // TenantID "tenant-1" == defaultClaims().TenantID
	h := newRolesHandler(&mockRolesRepo{role: &role})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodGet, "/", nil)
	r = withChiParam(r, "id", "role-custom")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Get).ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotNil(t, resp["data"])
}

func TestAdminRoles_Get_GlobalRole_Allowed(t *testing.T) {
	t.Parallel()
	global := domain.Role{ID: "role_owner", Name: "owner", TenantID: nil}
	h := newRolesHandler(&mockRolesRepo{role: &global})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodGet, "/", nil)
	r = withChiParam(r, "id", "role_owner")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Get).ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestAdminRoles_Get_OtherTenant_NotFound(t *testing.T) {
	t.Parallel()
	other := "other-tenant"
	role := domain.Role{ID: "role-x", Name: "Secret", TenantID: &other, Permissions: []string{"delete:tenant"}}
	h := newRolesHandler(&mockRolesRepo{role: &role})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodGet, "/", nil)
	r = withChiParam(r, "id", "role-x")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Get).ServeHTTP(w, r)

	// Must not leak another tenant's role name/permissions (BOLA).
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminRoles_Get_NotFound(t *testing.T) {
	t.Parallel()
	h := newRolesHandler(&mockRolesRepo{getErr: domain.ErrNotFound})

	r := withChiParam(httptest.NewRequest(http.MethodGet, "/", nil), "id", "missing")
	w := httptest.NewRecorder()
	h.Get(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// --- Create tests ---

func TestAdminRoles_Create_Valid(t *testing.T) {
	t.Parallel()
	h := newRolesHandler(&mockRolesRepo{})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPost, "/", map[string]any{
		"name":        "Editor",
		"permissions": []string{"read:posts", "write:posts"},
	})
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Create).ServeHTTP(w, r)

	require.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, "Editor", data["name"])
}

func TestAdminRoles_Create_MissingName(t *testing.T) {
	t.Parallel()
	h := newRolesHandler(&mockRolesRepo{})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPost, "/", map[string]any{})
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Create).ServeHTTP(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

// --- SetPermissions tests ---

func TestAdminRoles_SetPermissions_Valid(t *testing.T) {
	t.Parallel()
	role := sampleRoleFull() // TenantID == "tenant-1" matches defaultClaims().TenantID
	h := newRolesHandler(&mockRolesRepo{role: &role})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{
		"permissions": []string{"read:posts", "write:posts"},
	})
	r = withChiParam(r, "id", "role-custom")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.SetPermissions).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestAdminRoles_SetPermissions_WrongTenant(t *testing.T) {
	t.Parallel()
	otherTenantID := "other-tenant"
	role := domain.Role{ID: "role-custom", Name: "Custom", TenantID: &otherTenantID}
	h := newRolesHandler(&mockRolesRepo{role: &role})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{
		"permissions": []string{"read:posts"},
	})
	r = withChiParam(r, "id", "role-custom")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.SetPermissions).ServeHTTP(w, r)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

// --- Delete tests ---

func TestAdminRoles_Delete_Valid(t *testing.T) {
	t.Parallel()
	role := sampleRoleFull()
	h := newRolesHandler(&mockRolesRepo{role: &role})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodDelete, "/", nil)
	r = withChiParam(r, "id", "role-custom")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Delete).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

// --- ListPermissions tests ---

func TestAdminRoles_ListPermissions(t *testing.T) {
	t.Parallel()
	perms := []domain.Permission{
		{ID: "p1", Name: "read:posts"},
		{ID: "p2", Name: "write:posts"},
	}
	h := newRolesHandler(&mockRolesRepo{perms: perms})

	w := httptest.NewRecorder()
	h.ListPermissions(w, httptest.NewRequest(http.MethodGet, "/permissions", nil))

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].([]any)
	assert.Len(t, data, 2)
}
