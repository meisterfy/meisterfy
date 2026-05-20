package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	mw "github.com/mkt-maestro/mkt-maestro/internal/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- mock ---

type mockPostRepo struct {
	posts     []*domain.Post
	post      *domain.Post
	listErr   error
	getErr    error
	createErr error
	updateErr error
	deleteErr error
}

func (m *mockPostRepo) List(_ context.Context, _ string) ([]*domain.Post, error) {
	return m.posts, m.listErr
}
func (m *mockPostRepo) ListByStatus(_ context.Context, _, _ string) ([]*domain.Post, error) {
	return m.posts, m.listErr
}
func (m *mockPostRepo) GetByID(_ context.Context, _ string) (*domain.Post, error) {
	return m.post, m.getErr
}
func (m *mockPostRepo) GetByIDAndTenant(_ context.Context, _, _ string) (*domain.Post, error) {
	return m.post, m.getErr
}
func (m *mockPostRepo) Create(_ context.Context, _ *domain.Post) error { return m.createErr }
func (m *mockPostRepo) Update(_ context.Context, _ *domain.Post) error { return m.updateErr }
func (m *mockPostRepo) UpdateStatus(_ context.Context, _, _, _ string, _ *time.Time) error {
	return m.updateErr
}
func (m *mockPostRepo) Delete(_ context.Context, _, _ string) error { return m.deleteErr }

// --- helpers ---

func samplePost(tenantID string) *domain.Post {
	title := "Hello World"
	return &domain.Post{
		ID:       "post-1",
		TenantID: tenantID,
		Status:   domain.PostStatusDraft,
		Title:    &title,
		Content:  "Post content",
		Hashtags: []string{"#go"},
	}
}

func newPostsHandler(repo *mockPostRepo) *AdminPostsHandler {
	return NewAdminPostsHandler(repo, nil, nil) // nil publishResultRepo and audit — not exercised here
}

// requestWithClaims issues a JWT, wraps handler with AuthenticateAdmin, and returns (handler, request).
func requestWithClaims(t *testing.T, claims domain.UserClaims, method, path string, body any) (http.Handler, *http.Request, *domain.JWTService) {
	t.Helper()
	jwtSvc := newTestJWT()
	tok := issueTestToken(t, jwtSvc, claims)
	var r *http.Request
	if body != nil {
		r = httptest.NewRequest(method, path, jsonBody(body))
	} else {
		r = httptest.NewRequest(method, path, nil)
	}
	r.Header.Set("Authorization", "Bearer "+tok)
	return nil, r, jwtSvc
}

// wrapAuth wraps an http.HandlerFunc with JWT AuthenticateAdmin middleware.
func wrapAuth(jwtSvc *domain.JWTService, fn http.HandlerFunc) http.Handler {
	return mw.AuthenticateAdmin(jwtSvc)(fn)
}

// --- List tests ---

func TestAdminPosts_List_ReturnsTenantPosts(t *testing.T) {
	t.Parallel()
	posts := []*domain.Post{samplePost("t1")}
	h := newPostsHandler(&mockPostRepo{posts: posts})

	r := withChiParam(httptest.NewRequest(http.MethodGet, "/", nil), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.List(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].([]any)
	assert.Len(t, data, 1)
}

func TestAdminPosts_List_EmptyResult(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{posts: []*domain.Post{}})

	r := withChiParam(httptest.NewRequest(http.MethodGet, "/", nil), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.List(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].([]any)
	assert.Empty(t, data)
}

func TestAdminPosts_List_FilterByStatus(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{posts: []*domain.Post{samplePost("t1")}})

	r := withChiParam(httptest.NewRequest(http.MethodGet, "/?status=draft", nil), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.List(w, r)

	require.Equal(t, http.StatusOK, w.Code)
}

// --- Get tests ---

func TestAdminPosts_Get_Found(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{post: samplePost("t1")})

	r := withChiParams(httptest.NewRequest(http.MethodGet, "/", nil), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	w := httptest.NewRecorder()
	h.Get(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotNil(t, resp["data"])
}

func TestAdminPosts_Get_NotFound(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{getErr: domain.ErrNotFound})

	r := withChiParams(httptest.NewRequest(http.MethodGet, "/", nil), map[string]string{
		"tenantId": "t1", "id": "missing",
	})
	w := httptest.NewRecorder()
	h.Get(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// --- Create tests ---

func TestAdminPosts_Create_Valid(t *testing.T) {
	t.Parallel()
	// After Create, handler calls GetByIDAndTenant — return pre-set post.
	h := newPostsHandler(&mockPostRepo{post: samplePost("t1")})

	body := jsonBody(map[string]any{"content": "New post content", "title": "My Post"})
	r := withChiParam(httptest.NewRequest(http.MethodPost, "/", body), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.Create(w, r)

	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestAdminPosts_Create_InvalidJSON(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{})

	r := withChiParam(httptest.NewRequest(http.MethodPost, "/", jsonBody("bad")), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.Create(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminPosts_Create_MissingContent(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{})

	body := jsonBody(map[string]any{"title": "No content here"})
	r := withChiParam(httptest.NewRequest(http.MethodPost, "/", body), "tenantId", "t1")
	w := httptest.NewRecorder()
	h.Create(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

// --- Update tests ---

func TestAdminPosts_Update_Valid(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{post: samplePost("t1")})

	body := jsonBody(map[string]any{"content": "Updated content"})
	r := withChiParams(httptest.NewRequest(http.MethodPatch, "/", body), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	w := httptest.NewRecorder()
	h.Update(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdminPosts_Update_AllFields(t *testing.T) {
	t.Parallel()
	post := samplePost("t1")
	h := newPostsHandler(&mockPostRepo{post: post})

	title := "Updated Title"
	date := "2026-06-01"
	timeStr := "10:00"
	body := jsonBody(map[string]any{
		"title":          title,
		"content":        "Updated content",
		"hashtags":       []string{"#updated", "#test"},
		"platforms":      []string{"instagram", "facebook"},
		"scheduled_date": date,
		"scheduled_time": timeStr,
	})
	r := withChiParams(httptest.NewRequest(http.MethodPatch, "/", body), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	w := httptest.NewRecorder()
	h.Update(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdminPosts_Update_StorageError(t *testing.T) {
	t.Parallel()
	post := samplePost("t1")
	h := newPostsHandler(&mockPostRepo{post: post, updateErr: domain.ErrInvalid})

	body := jsonBody(map[string]any{"content": "Updated"})
	r := withChiParams(httptest.NewRequest(http.MethodPatch, "/", body), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	w := httptest.NewRecorder()
	h.Update(w, r)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestAdminPosts_Update_InvalidJSON(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{post: samplePost("t1")})

	r := withChiParams(httptest.NewRequest(http.MethodPatch, "/", jsonBody("bad")), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	w := httptest.NewRecorder()
	h.Update(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminPosts_Update_NotFound(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{getErr: domain.ErrNotFound})

	body := jsonBody(map[string]any{"content": "Updated"})
	r := withChiParams(httptest.NewRequest(http.MethodPatch, "/", body), map[string]string{
		"tenantId": "t1", "id": "missing",
	})
	w := httptest.NewRecorder()
	h.Update(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// --- UpdateStatus tests ---

func TestAdminPosts_UpdateStatus_NotFound(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{getErr: domain.ErrNotFound})

	body := jsonBody(map[string]any{"status": "approved"})
	r := withChiParams(httptest.NewRequest(http.MethodPatch, "/", body), map[string]string{
		"tenantId": "t1", "id": "missing",
	})
	w := httptest.NewRecorder()
	h.UpdateStatus(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminPosts_UpdateStatus_InvalidJSON(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{post: samplePost("t1")})

	r := withChiParams(httptest.NewRequest(http.MethodPatch, "/", jsonBody("bad")), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	w := httptest.NewRecorder()
	h.UpdateStatus(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminPosts_UpdateStatus_MissingStatus(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{post: samplePost("t1")})

	body := jsonBody(map[string]any{}) // missing "status"
	r := withChiParams(httptest.NewRequest(http.MethodPatch, "/", body), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	w := httptest.NewRecorder()
	h.UpdateStatus(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminPosts_UpdateStatus_InvalidTransition(t *testing.T) {
	t.Parallel()
	post := samplePost("t1")
	post.Status = domain.PostStatusPublished // published → nothing allowed
	h := newPostsHandler(&mockPostRepo{post: post})

	body := jsonBody(map[string]any{"status": "draft"})
	r := withChiParams(httptest.NewRequest(http.MethodPatch, "/", body), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	w := httptest.NewRecorder()
	h.UpdateStatus(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAdminPosts_UpdateStatus_MissingPermission(t *testing.T) {
	t.Parallel()
	// Claims present but without "approve:post" → 403
	jwtSvc := newTestJWT()
	tok := issueTestToken(t, jwtSvc, domain.UserClaims{
		UserID: "u1", TenantID: "t1", Permissions: []string{"read:posts"},
	})
	post := samplePost("t1")
	h := newPostsHandler(&mockPostRepo{post: post})
	wrapped := wrapAuth(jwtSvc, h.UpdateStatus)

	body := jsonBody(map[string]any{"status": "approved"})
	r := withChiParams(httptest.NewRequest(http.MethodPatch, "/", body), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	r.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, r)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestAdminPosts_UpdateStatus_ValidTransition(t *testing.T) {
	t.Parallel()
	jwtSvc := newTestJWT()
	tok := issueTestToken(t, jwtSvc, domain.UserClaims{
		UserID: "u1", TenantID: "t1", Permissions: []string{"approve:post"},
	})
	post := samplePost("t1")
	// After UpdateStatus the handler calls GetByIDAndTenant again — same mock returns same post.
	h := newPostsHandler(&mockPostRepo{post: post})
	wrapped := wrapAuth(jwtSvc, h.UpdateStatus)

	body := jsonBody(map[string]any{"status": "approved"})
	r := withChiParams(httptest.NewRequest(http.MethodPatch, "/", body), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	r.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
}

// --- Delete tests ---

func TestAdminPosts_Delete_Valid(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{post: samplePost("t1")})

	r := withChiParams(httptest.NewRequest(http.MethodDelete, "/", nil), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	w := httptest.NewRecorder()
	h.Delete(w, r)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestAdminPosts_Delete_InternalError(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{deleteErr: domain.ErrInvalid}) // non-ErrNotFound error

	r := withChiParams(httptest.NewRequest(http.MethodDelete, "/", nil), map[string]string{
		"tenantId": "t1", "id": "post-1",
	})
	w := httptest.NewRecorder()
	h.Delete(w, r)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestAdminPosts_Delete_NotFound(t *testing.T) {
	t.Parallel()
	h := newPostsHandler(&mockPostRepo{deleteErr: domain.ErrNotFound})

	r := withChiParams(httptest.NewRequest(http.MethodDelete, "/", nil), map[string]string{
		"tenantId": "t1", "id": "missing",
	})
	w := httptest.NewRecorder()
	h.Delete(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

