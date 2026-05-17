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

type mockUserAdminRepo struct {
	users     []*domain.User
	user      *domain.User
	listErr   error
	getErr    error
	createErr error
	updateErr error
	deleteErr error
}

func (m *mockUserAdminRepo) ListForTenant(_ context.Context, _ string, _ *bool) ([]*domain.User, error) {
	return m.users, m.listErr
}
func (m *mockUserAdminRepo) GetByID(_ context.Context, _ string) (*domain.User, error) {
	return m.user, m.getErr
}
func (m *mockUserAdminRepo) Create(_ context.Context, _ *domain.User) error {
	return m.createErr
}
func (m *mockUserAdminRepo) Update(_ context.Context, _ *domain.User) error {
	return m.updateErr
}
func (m *mockUserAdminRepo) Delete(_ context.Context, _ string) error {
	return m.deleteErr
}
func (m *mockUserAdminRepo) GetByEmail(_ context.Context, _ string) (*domain.User, error) {
	return m.user, m.getErr
}

type mockUsersRBACRepo struct {
	role              *domain.Role
	roles             map[string]*domain.Role
	assignErr         error
	removeErr         error
	removeAllErr      error
	getRoleErr        error
	getRolesErr       error
}

func (m *mockUsersRBACRepo) AssignRole(_ context.Context, _, _, _ string) error {
	return m.assignErr
}
func (m *mockUsersRBACRepo) RemoveRole(_ context.Context, _, _, _ string) error {
	return m.removeErr
}
func (m *mockUsersRBACRepo) GetRoleForUser(_ context.Context, _, _ string) (*domain.Role, error) {
	return m.role, m.getRoleErr
}
func (m *mockUsersRBACRepo) GetRolesForUsers(_ context.Context, _ []string, _ string) (map[string]*domain.Role, error) {
	return m.roles, m.getRolesErr
}
func (m *mockUsersRBACRepo) RemoveAllRolesForUserInTenant(_ context.Context, _, _ string) error {
	return m.removeAllErr
}

// --- helpers ---

func sampleAdminUser() *domain.User {
	return &domain.User{
		ID:       "user-2",
		Name:     "Bob",
		Email:    "bob@example.com",
		IsActive: true,
	}
}

func sampleRole() *domain.Role {
	return &domain.Role{ID: "role_member", Name: "Member"}
}

func newUsersHandler(userRepo *mockUserAdminRepo, rbac *mockUsersRBACRepo) *AdminUsersHandler {
	if rbac == nil {
		rbac = &mockUsersRBACRepo{}
	}
	return NewAdminUsersHandler(userRepo, rbac, &mockAudit{})
}

// --- List tests ---

func TestAdminUsers_List_ForTenant(t *testing.T) {
	t.Parallel()
	users := []*domain.User{sampleAdminUser()}
	h := newUsersHandler(
		&mockUserAdminRepo{users: users},
		&mockUsersRBACRepo{roles: map[string]*domain.Role{"user-2": sampleRole()}},
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.List).ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].([]any)
	assert.Len(t, data, 1)
}

func TestAdminUsers_List_Empty(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(&mockUserAdminRepo{users: []*domain.User{}}, nil)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.List).ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Empty(t, resp["data"].([]any))
}

// --- Get tests ---

func TestAdminUsers_Get_Found(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(
		&mockUserAdminRepo{user: sampleAdminUser()},
		&mockUsersRBACRepo{role: sampleRole()},
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodGet, "/", nil)
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Get).ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotNil(t, resp["data"])
}

func TestAdminUsers_Get_NotFound(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(&mockUserAdminRepo{getErr: domain.ErrNotFound}, nil)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodGet, "/", nil)
	r = withChiParam(r, "id", "missing")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Get).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminUsers_Get_NotInTenant(t *testing.T) {
	t.Parallel()
	// User exists but GetRoleForUser returns nil (not in caller's tenant).
	h := newUsersHandler(
		&mockUserAdminRepo{user: sampleAdminUser()},
		&mockUsersRBACRepo{role: nil},
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodGet, "/", nil)
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Get).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// --- Create tests ---

func TestAdminUsers_Create_Valid(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(&mockUserAdminRepo{}, &mockUsersRBACRepo{})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPost, "/", map[string]any{
		"name":     "Carol",
		"email":    "carol@example.com",
		"password": "securepass1",
		"role_id":  "role_member",
	})
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Create).ServeHTTP(w, r)

	require.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotNil(t, resp["data"])
}

func TestAdminUsers_Create_DuplicateEmail(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(&mockUserAdminRepo{createErr: domain.ErrConflict}, nil)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPost, "/", map[string]any{
		"name":     "Carol",
		"email":    "carol@example.com",
		"password": "securepass1",
	})
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Create).ServeHTTP(w, r)

	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestAdminUsers_Create_MissingRequired(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(&mockUserAdminRepo{}, nil)

	cases := []struct {
		name string
		body map[string]any
	}{
		{"missing name", map[string]any{"email": "x@x.com", "password": "securepass1"}},
		{"missing email", map[string]any{"name": "X", "password": "securepass1"}},
		{"missing password", map[string]any{"name": "X", "email": "x@x.com"}},
		{"weak password", map[string]any{"name": "X", "email": "x@x.com", "password": "short"}},
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

func TestAdminUsers_Update_Valid(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(
		&mockUserAdminRepo{user: sampleAdminUser()},
		&mockUsersRBACRepo{role: sampleRole()},
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{
		"name": "Bob Updated",
	})
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Update).ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestAdminUsers_Update_NotFound(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(&mockUserAdminRepo{getErr: domain.ErrNotFound}, nil)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{"name": "X"})
	r = withChiParam(r, "id", "missing")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Update).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminUsers_Update_NotInTenant(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(
		&mockUserAdminRepo{user: sampleAdminUser()},
		&mockUsersRBACRepo{role: nil}, // user not in caller's tenant
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{"name": "X"})
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Update).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminUsers_Update_InvalidJSON(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(
		&mockUserAdminRepo{user: sampleAdminUser()},
		&mockUsersRBACRepo{role: sampleRole()},
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", "not-an-object")
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Update).ServeHTTP(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminUsers_Update_AllFields(t *testing.T) {
	t.Parallel()
	isActive := false
	h := newUsersHandler(
		&mockUserAdminRepo{user: sampleAdminUser()},
		&mockUsersRBACRepo{role: sampleRole()},
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{
		"name":      "Bob Updated",
		"email":     "bob2@example.com",
		"locale":    "pt_BR",
		"timezone":  "America/Sao_Paulo",
		"is_active": isActive,
	})
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Update).ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestAdminUsers_Update_ConflictEmail(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(
		&mockUserAdminRepo{user: sampleAdminUser(), updateErr: domain.ErrConflict},
		&mockUsersRBACRepo{role: sampleRole()},
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{
		"email": "taken@example.com",
	})
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Update).ServeHTTP(w, r)

	assert.Equal(t, http.StatusConflict, w.Code)
}

// --- Delete tests ---

func TestAdminUsers_Delete_SoftDelete(t *testing.T) {
	t.Parallel()
	user := sampleAdminUser()
	h := newUsersHandler(
		&mockUserAdminRepo{user: user},
		&mockUsersRBACRepo{role: sampleRole()},
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodDelete, "/", nil)
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Delete).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestAdminUsers_Delete_NotFound(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(&mockUserAdminRepo{getErr: domain.ErrNotFound}, nil)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodDelete, "/", nil)
	r = withChiParam(r, "id", "missing")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Delete).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminUsers_Delete_NotInTenant(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(
		&mockUserAdminRepo{user: sampleAdminUser()},
		&mockUsersRBACRepo{role: nil},
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodDelete, "/", nil)
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.Delete).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// --- AssignRole tests ---

func TestAdminUsers_AssignRole_Valid(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(
		&mockUserAdminRepo{user: sampleAdminUser()},
		&mockUsersRBACRepo{role: sampleRole()},
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{
		"role_id": "role_owner",
	})
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.AssignRole).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestAdminUsers_AssignRole_MissingRoleID(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(&mockUserAdminRepo{user: sampleAdminUser()}, &mockUsersRBACRepo{role: sampleRole()})

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{})
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.AssignRole).ServeHTTP(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminUsers_AssignRole_UserNotFound(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(&mockUserAdminRepo{getErr: domain.ErrNotFound}, nil)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{"role_id": "role_member"})
	r = withChiParam(r, "id", "missing")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.AssignRole).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminUsers_AssignRole_NotInTenant(t *testing.T) {
	t.Parallel()
	h := newUsersHandler(
		&mockUserAdminRepo{user: sampleAdminUser()},
		&mockUsersRBACRepo{role: nil},
	)

	_, r, jwtSvc := requestWithClaims(t, defaultClaims(), http.MethodPut, "/", map[string]any{"role_id": "role_member"})
	r = withChiParam(r, "id", "user-2")
	w := httptest.NewRecorder()
	wrapAuth(jwtSvc, h.AssignRole).ServeHTTP(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
