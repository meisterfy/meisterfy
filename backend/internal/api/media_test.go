package api

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockMediaPostRepo struct {
	post      *domain.Post
	getErr    error
	updateCnt int
}

func (m *mockMediaPostRepo) GetByID(_ context.Context, _ string) (*domain.Post, error) {
	return m.post, m.getErr
}

func (m *mockMediaPostRepo) Update(_ context.Context, _ *domain.Post) error {
	m.updateCnt++
	return nil
}

// pngBytes / webmBytes are minimal byte slices whose signatures
// http.DetectContentType recognises as image/png and video/webm.
var (
	pngBytes  = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
	webmBytes = []byte("\x1a\x45\xdf\xa3\x01\x00\x00\x00\x00\x00\x00\x1f")
)

func multipartReq(t *testing.T, filename string, content []byte) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile("file", filename)
	require.NoError(t, err)
	_, err = fw.Write(content)
	require.NoError(t, err)
	require.NoError(t, mw.Close())

	r := httptest.NewRequest(http.MethodPost, "/", &buf)
	r.Header.Set("Content-Type", mw.FormDataContentType())
	return r
}

func uploadReq(t *testing.T, tenantID, postID, callerTenant, filename string, content []byte) *http.Request {
	t.Helper()
	r := multipartReq(t, filename, content)
	r = withChiParams(r, map[string]string{"tenantId": tenantID, "postId": postID})
	return r.WithContext(middleware.WithUserClaims(r.Context(), &domain.UserClaims{TenantID: callerTenant}))
}

// A2: a non-image payload (HTML) must be rejected even if named *.png.
func TestMedia_Upload_RejectsNonImage(t *testing.T) {
	t.Parallel()
	h := NewMediaHandler(t.TempDir(), &mockMediaPostRepo{post: &domain.Post{ID: "post-1", TenantID: "t1"}})

	r := uploadReq(t, "t1", "post-1", "t1", "evil.png", []byte("<html><script>alert(1)</script></html>"))
	w := httptest.NewRecorder()
	h.Upload(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

// A2: the stored object name uses the (allowlisted) extension; an image with a
// real extension is accepted and bound to the post.
func TestMedia_Upload_StoresAllowlistedImage(t *testing.T) {
	t.Parallel()
	repo := &mockMediaPostRepo{post: &domain.Post{ID: "post-1", TenantID: "t1"}}
	h := NewMediaHandler(t.TempDir(), repo)

	r := uploadReq(t, "t1", "post-1", "t1", "photo.png", pngBytes)
	w := httptest.NewRecorder()
	h.Upload(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	files := resp["media_files"].([]any)
	require.Len(t, files, 1)
	assert.Equal(t, "post-1.png", files[0])
	assert.Equal(t, 1, repo.updateCnt)
}

// Video is a supported post medium and must be accepted.
func TestMedia_Upload_AcceptsVideo(t *testing.T) {
	t.Parallel()
	repo := &mockMediaPostRepo{post: &domain.Post{ID: "post-1", TenantID: "t1"}}
	h := NewMediaHandler(t.TempDir(), repo)

	r := uploadReq(t, "t1", "post-1", "t1", "clip.webm", webmBytes)
	w := httptest.NewRecorder()
	h.Upload(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	files := resp["media_files"].([]any)
	require.Len(t, files, 1)
	assert.Equal(t, "post-1.webm", files[0])
}

// A disallowed extension (e.g. .svg) is rejected outright.
func TestMedia_Upload_RejectsDisallowedExtension(t *testing.T) {
	t.Parallel()
	h := NewMediaHandler(t.TempDir(), &mockMediaPostRepo{post: &domain.Post{ID: "post-1", TenantID: "t1"}})

	r := uploadReq(t, "t1", "post-1", "t1", "icon.svg", []byte("<svg onload=alert(1)></svg>"))
	w := httptest.NewRecorder()
	h.Upload(w, r)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

// A3: uploading against a postID owned by another tenant must not modify that
// post (IDOR).
func TestMedia_Upload_DoesNotTouchOtherTenantPost(t *testing.T) {
	t.Parallel()
	repo := &mockMediaPostRepo{post: &domain.Post{ID: "post-1", TenantID: "other"}}
	h := NewMediaHandler(t.TempDir(), repo)

	r := uploadReq(t, "t1", "post-1", "t1", "x.png", pngBytes)
	w := httptest.NewRecorder()
	h.Upload(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, 0, repo.updateCnt) // foreign-tenant post left untouched
}

// A2: Serve refuses to return files whose extension is outside the image
// allowlist, so an *.html artifact can never be served as text/html.
func TestMedia_Serve_RejectsNonImageExtension(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(dir, "t1"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "t1", "x.html"), []byte("<script>alert(1)</script>"), 0o644))
	h := NewMediaHandler(dir, &mockMediaPostRepo{})

	r := withChiParams(httptest.NewRequest(http.MethodGet, "/", nil), map[string]string{"tenantId": "t1", "filename": "x.html"})
	w := httptest.NewRecorder()
	h.Serve(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// A2: served images carry a fixed image Content-Type plus anti-sniffing headers.
func TestMedia_Serve_ImageHasSafeHeaders(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(dir, "t1"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "t1", "a.png"), pngBytes, 0o644))
	h := NewMediaHandler(dir, &mockMediaPostRepo{})

	r := withChiParams(httptest.NewRequest(http.MethodGet, "/", nil), map[string]string{"tenantId": "t1", "filename": "a.png"})
	w := httptest.NewRecorder()
	h.Serve(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "image/png", w.Header().Get("Content-Type"))
	assert.Equal(t, "nosniff", w.Header().Get("X-Content-Type-Options"))
}
