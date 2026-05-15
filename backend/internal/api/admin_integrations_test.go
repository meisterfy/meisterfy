package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	// side-effect import: registers "claude" provider so Create/Update tests have a valid provider.
	_ "github.com/mkt-maestro/mkt-maestro/internal/connector/anthropic"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- mock ---

type mockIntegrationRepo struct {
	integrations  []*domain.Integration
	ig            *domain.Integration
	listErr       error
	getErr        error
	createErr     error
	updateErr     error
	deleteErr     error
	setTenantsErr error
}

func (m *mockIntegrationRepo) List(_ context.Context) ([]*domain.Integration, error) {
	return m.integrations, m.listErr
}
func (m *mockIntegrationRepo) GetByID(_ context.Context, _ string) (*domain.Integration, error) {
	return m.ig, m.getErr
}
func (m *mockIntegrationRepo) Create(_ context.Context, _ *domain.Integration) error {
	return m.createErr
}
func (m *mockIntegrationRepo) Update(_ context.Context, _ *domain.Integration) error {
	return m.updateErr
}
func (m *mockIntegrationRepo) Delete(_ context.Context, _ string) error {
	return m.deleteErr
}
func (m *mockIntegrationRepo) SetTenants(_ context.Context, _ string, _ []string) error {
	return m.setTenantsErr
}

// --- helpers ---

func sampleIntegration() *domain.Integration {
	return &domain.Integration{
		ID:       "ig-1",
		Name:     "My Claude",
		Provider: domain.ProviderClaude,
		Group:    domain.GroupLLM,
		Status:   domain.StatusPending,
		Config:   map[string]any{},
	}
}

func newIntegrationsHandler(repo *mockIntegrationRepo) *AdminIntegrationsHandler {
	return NewAdminIntegrationsHandler(repo, nil) // nil audit — not exercised here
}

// --- List tests ---

func TestAdminIntegrations_List(t *testing.T) {
	t.Parallel()
	igs := []*domain.Integration{sampleIntegration()}
	h := newIntegrationsHandler(&mockIntegrationRepo{integrations: igs})

	w := httptest.NewRecorder()
	h.List(w, httptest.NewRequest(http.MethodGet, "/", nil))

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotNil(t, resp["integrations"])
	assert.NotNil(t, resp["providers"])
}

func TestAdminIntegrations_List_Empty(t *testing.T) {
	t.Parallel()
	h := newIntegrationsHandler(&mockIntegrationRepo{integrations: []*domain.Integration{}})

	w := httptest.NewRecorder()
	h.List(w, httptest.NewRequest(http.MethodGet, "/", nil))

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	igs := resp["integrations"].([]any)
	assert.Empty(t, igs)
}

// --- Get tests ---

func TestAdminIntegrations_Get_Found(t *testing.T) {
	t.Parallel()
	h := newIntegrationsHandler(&mockIntegrationRepo{ig: sampleIntegration()})

	r := withChiParam(httptest.NewRequest(http.MethodGet, "/", nil), "id", "ig-1")
	w := httptest.NewRecorder()
	h.Get(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotNil(t, resp["data"])
}

func TestAdminIntegrations_Get_NotFound(t *testing.T) {
	t.Parallel()
	h := newIntegrationsHandler(&mockIntegrationRepo{getErr: domain.ErrNotFound})

	r := withChiParam(httptest.NewRequest(http.MethodGet, "/", nil), "id", "missing")
	w := httptest.NewRecorder()
	h.Get(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// --- Create tests ---

func TestAdminIntegrations_Create_Valid(t *testing.T) {
	t.Parallel()
	// After Create, handler calls GetByID — return pre-set integration.
	ig := sampleIntegration()
	h := newIntegrationsHandler(&mockIntegrationRepo{ig: ig})

	body := jsonBody(map[string]any{
		"name":     "My Claude",
		"provider": "claude",
	})
	w := httptest.NewRecorder()
	h.Create(w, httptest.NewRequest(http.MethodPost, "/", body))

	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestAdminIntegrations_Create_InvalidJSON(t *testing.T) {
	t.Parallel()
	h := newIntegrationsHandler(&mockIntegrationRepo{})

	w := httptest.NewRecorder()
	h.Create(w, httptest.NewRequest(http.MethodPost, "/", jsonBody("bad")))

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminIntegrations_Create_MissingNameOrProvider(t *testing.T) {
	t.Parallel()
	h := newIntegrationsHandler(&mockIntegrationRepo{})

	cases := []struct {
		name string
		body map[string]any
	}{
		{"missing name", map[string]any{"provider": "claude"}},
		{"missing provider", map[string]any{"name": "My Integration"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			w := httptest.NewRecorder()
			h.Create(w, httptest.NewRequest(http.MethodPost, "/", jsonBody(tc.body)))
			assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		})
	}
}

func TestAdminIntegrations_Create_UnknownProvider(t *testing.T) {
	t.Parallel()
	h := newIntegrationsHandler(&mockIntegrationRepo{})

	body := jsonBody(map[string]any{"name": "My IG", "provider": "unknown_provider"})
	w := httptest.NewRecorder()
	h.Create(w, httptest.NewRequest(http.MethodPost, "/", body))

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminIntegrations_Create_WithCredential(t *testing.T) {
	t.Parallel()
	ig := sampleIntegration()
	h := newIntegrationsHandler(&mockIntegrationRepo{ig: ig})

	// oauth_client_secret is a CredentialField for "claude" — exercises applyFieldToIntegration.
	body := jsonBody(map[string]any{
		"name":               "My Claude",
		"provider":           "claude",
		"oauth_client_secret": "sk-ant-test-key",
	})
	w := httptest.NewRecorder()
	h.Create(w, httptest.NewRequest(http.MethodPost, "/", body))

	assert.Equal(t, http.StatusCreated, w.Code)
}

// --- Update tests ---

func TestAdminIntegrations_Update_Valid(t *testing.T) {
	t.Parallel()
	ig := sampleIntegration()
	// GetByID is called twice: before and after update.
	h := newIntegrationsHandler(&mockIntegrationRepo{ig: ig})

	body := jsonBody(map[string]any{"name": "Updated Name"})
	r := withChiParam(httptest.NewRequest(http.MethodPut, "/", body), "id", "ig-1")
	w := httptest.NewRecorder()
	h.Update(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdminIntegrations_Update_WithCredential(t *testing.T) {
	t.Parallel()
	ig := sampleIntegration()
	h := newIntegrationsHandler(&mockIntegrationRepo{ig: ig})

	// passes oauth_client_secret + a config field "model" → exercises applyFieldToIntegration default branch
	body := jsonBody(map[string]any{
		"oauth_client_secret": "sk-ant-new-key",
		"model":               "claude-sonnet-4-6",
	})
	r := withChiParam(httptest.NewRequest(http.MethodPut, "/", body), "id", "ig-1")
	w := httptest.NewRecorder()
	h.Update(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdminIntegrations_Update_InvalidJSON(t *testing.T) {
	t.Parallel()
	ig := sampleIntegration()
	h := newIntegrationsHandler(&mockIntegrationRepo{ig: ig})

	r := withChiParam(httptest.NewRequest(http.MethodPut, "/", jsonBody("bad")), "id", "ig-1")
	w := httptest.NewRecorder()
	h.Update(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminIntegrations_Update_NotFound(t *testing.T) {
	t.Parallel()
	h := newIntegrationsHandler(&mockIntegrationRepo{getErr: domain.ErrNotFound})

	body := jsonBody(map[string]any{"name": "Updated"})
	r := withChiParam(httptest.NewRequest(http.MethodPut, "/", body), "id", "missing")
	w := httptest.NewRecorder()
	h.Update(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminIntegrations_Update_SetTenants(t *testing.T) {
	t.Parallel()
	ig := sampleIntegration()
	h := newIntegrationsHandler(&mockIntegrationRepo{ig: ig})

	body := jsonBody(map[string]any{"tenant_ids": []string{"t1", "t2"}})
	r := withChiParam(httptest.NewRequest(http.MethodPut, "/", body), "id", "ig-1")
	w := httptest.NewRecorder()
	h.Update(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
}

// --- Delete tests ---

func TestAdminIntegrations_Delete_Valid(t *testing.T) {
	t.Parallel()
	ig := sampleIntegration()
	h := newIntegrationsHandler(&mockIntegrationRepo{ig: ig})

	r := withChiParam(httptest.NewRequest(http.MethodDelete, "/", nil), "id", "ig-1")
	w := httptest.NewRecorder()
	h.Delete(w, r)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestAdminIntegrations_Delete_NotFound(t *testing.T) {
	t.Parallel()
	h := newIntegrationsHandler(&mockIntegrationRepo{deleteErr: domain.ErrNotFound})

	r := withChiParam(httptest.NewRequest(http.MethodDelete, "/", nil), "id", "missing")
	w := httptest.NewRecorder()
	h.Delete(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// --- SetTenants tests ---

func TestAdminIntegrations_SetTenants_Valid(t *testing.T) {
	t.Parallel()
	ig := sampleIntegration()
	h := newIntegrationsHandler(&mockIntegrationRepo{ig: ig})

	body := jsonBody(map[string]any{"tenant_ids": []string{"t1"}})
	r := withChiParam(httptest.NewRequest(http.MethodPut, "/", body), "id", "ig-1")
	w := httptest.NewRecorder()
	h.SetTenants(w, r)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestAdminIntegrations_SetTenants_NotFound(t *testing.T) {
	t.Parallel()
	h := newIntegrationsHandler(&mockIntegrationRepo{getErr: domain.ErrNotFound})

	body := jsonBody(map[string]any{"tenant_ids": []string{"t1"}})
	r := withChiParam(httptest.NewRequest(http.MethodPut, "/", body), "id", "missing")
	w := httptest.NewRecorder()
	h.SetTenants(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminIntegrations_SetTenants_InvalidJSON(t *testing.T) {
	t.Parallel()
	ig := sampleIntegration()
	h := newIntegrationsHandler(&mockIntegrationRepo{ig: ig})

	r := withChiParam(httptest.NewRequest(http.MethodPut, "/", jsonBody("bad")), "id", "ig-1")
	w := httptest.NewRecorder()
	h.SetTenants(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminIntegrations_SetTenants_EmptyList(t *testing.T) {
	t.Parallel()
	ig := sampleIntegration()
	h := newIntegrationsHandler(&mockIntegrationRepo{ig: ig})

	body := jsonBody(map[string]any{"tenant_ids": []string{}})
	r := withChiParam(httptest.NewRequest(http.MethodPut, "/", body), "id", "ig-1")
	w := httptest.NewRecorder()
	h.SetTenants(w, r)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

// --- ListProviders test ---

func TestAdminIntegrations_ListProviders(t *testing.T) {
	t.Parallel()
	h := newIntegrationsHandler(&mockIntegrationRepo{})

	w := httptest.NewRecorder()
	h.ListProviders(w, httptest.NewRequest(http.MethodGet, "/providers", nil))

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].([]any)
	assert.NotEmpty(t, data) // at least "claude" provider is registered via blank import
}
