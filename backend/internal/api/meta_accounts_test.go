package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/stretchr/testify/assert"
)

// --- mocks ---

type mockMetaIntegrationRepo struct {
	integration *domain.Integration
	err         error
}

func (m *mockMetaIntegrationRepo) GetForTenant(_ context.Context, _, _ string) (*domain.Integration, error) {
	return m.integration, m.err
}

type mockMetaResourceStore struct {
	resources []*domain.ConnectorResource
	listErr   error
	upsertErr error
	deleteErr error
}

func (m *mockMetaResourceStore) List(_ context.Context, _ string, _ domain.IntegrationProvider, _ string) ([]*domain.ConnectorResource, error) {
	return m.resources, m.listErr
}

func (m *mockMetaResourceStore) Upsert(_ context.Context, _ *domain.ConnectorResource) error {
	return m.upsertErr
}

func (m *mockMetaResourceStore) Delete(_ context.Context, _ string) error {
	return m.deleteErr
}

func newMetaAccountsHandler(ig *mockMetaIntegrationRepo, store *mockMetaResourceStore) *MetaAccountsHandler {
	return NewMetaAccountsHandler(ig, store)
}

// --- ListAvailablePages ---

func TestMetaAccounts_ListAvailablePages_NoIntegration(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(
		&mockMetaIntegrationRepo{err: domain.ErrNotFound},
		&mockMetaResourceStore{},
	)
	r := withChiParam(httptest.NewRequest(http.MethodGet, "/", nil), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.ListAvailablePages(w, r)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestMetaAccounts_ListAvailablePages_NoRefreshToken(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(
		&mockMetaIntegrationRepo{integration: &domain.Integration{ID: "ig-1", RefreshToken: nil}},
		&mockMetaResourceStore{},
	)
	r := withChiParam(httptest.NewRequest(http.MethodGet, "/", nil), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.ListAvailablePages(w, r)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestMetaAccounts_ListAvailablePages_IntegrationRepoError(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(
		&mockMetaIntegrationRepo{err: errors.New("db unavailable")},
		&mockMetaResourceStore{},
	)
	r := withChiParam(httptest.NewRequest(http.MethodGet, "/", nil), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.ListAvailablePages(w, r)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestMetaAccounts_ListAvailablePages_LiveMeta(t *testing.T) {
	t.Parallel()
	t.Skip("requires live Meta API — set META_ACCESS_TOKEN to run locally")
}

// --- ActivatePage ---

func TestMetaAccounts_ActivatePage_InvalidJSON(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(&mockMetaIntegrationRepo{}, &mockMetaResourceStore{})
	r := withChiParam(httptest.NewRequest(http.MethodPost, "/", jsonBody("not-an-object")), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.ActivatePage(w, r)
	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestMetaAccounts_ActivatePage_MissingPageID(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(&mockMetaIntegrationRepo{}, &mockMetaResourceStore{})
	body := map[string]any{"page_name": "My Page"}
	r := withChiParam(httptest.NewRequest(http.MethodPost, "/", jsonBody(body)), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.ActivatePage(w, r)
	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestMetaAccounts_ActivatePage_MissingPageName(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(&mockMetaIntegrationRepo{}, &mockMetaResourceStore{})
	body := map[string]any{"page_id": "123"}
	r := withChiParam(httptest.NewRequest(http.MethodPost, "/", jsonBody(body)), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.ActivatePage(w, r)
	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestMetaAccounts_ActivatePage_NoIntegration(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(
		&mockMetaIntegrationRepo{err: domain.ErrNotFound},
		&mockMetaResourceStore{},
	)
	body := map[string]any{"page_id": "123", "page_name": "My Page"}
	r := withChiParam(httptest.NewRequest(http.MethodPost, "/", jsonBody(body)), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.ActivatePage(w, r)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestMetaAccounts_ActivatePage_NoRefreshToken(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(
		&mockMetaIntegrationRepo{integration: &domain.Integration{ID: "ig-1", RefreshToken: nil}},
		&mockMetaResourceStore{},
	)
	body := map[string]any{"page_id": "123", "page_name": "My Page"}
	r := withChiParam(httptest.NewRequest(http.MethodPost, "/", jsonBody(body)), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.ActivatePage(w, r)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestMetaAccounts_ActivatePage_IntegrationRepoError(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(
		&mockMetaIntegrationRepo{err: errors.New("db unavailable")},
		&mockMetaResourceStore{},
	)
	body := map[string]any{"page_id": "123", "page_name": "My Page"}
	r := withChiParam(httptest.NewRequest(http.MethodPost, "/", jsonBody(body)), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.ActivatePage(w, r)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestMetaAccounts_ActivatePage_LiveMeta(t *testing.T) {
	t.Parallel()
	t.Skip("requires live Meta API — set META_ACCESS_TOKEN to run locally")
}

// --- RemovePage ---

func TestMetaAccounts_RemovePage_Success(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(&mockMetaIntegrationRepo{}, &mockMetaResourceStore{})
	r := withChiParam(httptest.NewRequest(http.MethodDelete, "/", nil), "resourceId", "res-123")
	w := httptest.NewRecorder()
	h.RemovePage(w, r)
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestMetaAccounts_RemovePage_NotFound(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(
		&mockMetaIntegrationRepo{},
		&mockMetaResourceStore{deleteErr: domain.ErrNotFound},
	)
	r := withChiParam(httptest.NewRequest(http.MethodDelete, "/", nil), "resourceId", "res-missing")
	w := httptest.NewRecorder()
	h.RemovePage(w, r)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestMetaAccounts_RemovePage_InternalError(t *testing.T) {
	t.Parallel()
	h := newMetaAccountsHandler(
		&mockMetaIntegrationRepo{},
		&mockMetaResourceStore{deleteErr: errors.New("db unavailable")},
	)
	r := withChiParam(httptest.NewRequest(http.MethodDelete, "/", nil), "resourceId", "res-err")
	w := httptest.NewRecorder()
	h.RemovePage(w, r)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}
