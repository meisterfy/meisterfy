package api

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/middleware"
)

// allowedMediaTypes maps permitted (lowercase) file extensions to the exact
// Content-Type served back. Pinning the served Content-Type to this allowlist
// (never text/html or image/svg+xml) means stored bytes can never execute as
// script when fetched from the public Serve endpoint, preventing stored XSS,
// while still supporting the images and videos the app publishes.
var allowedMediaTypes = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".gif":  "image/gif",
	".webp": "image/webp",
	".mp4":  "video/mp4",
	".webm": "video/webm",
	".mov":  "video/quicktime",
}

// isSafeMediaContent reports whether sniffed content is binary image/video data
// rather than markup or text (e.g. HTML/SVG/XML) that a browser could execute.
func isSafeMediaContent(contentType string) bool {
	ct, _, _ := strings.Cut(contentType, ";")
	ct = strings.TrimSpace(ct)
	return strings.HasPrefix(ct, "image/") ||
		strings.HasPrefix(ct, "video/") ||
		ct == "application/octet-stream"
}

type MediaHandler struct {
	storagePath string
	postRepo    interface {
		GetByID(ctx context.Context, id string) (*domain.Post, error)
		Update(ctx context.Context, p *domain.Post) error
	}
}

func NewMediaHandler(storagePath string, postRepo interface {
	GetByID(ctx context.Context, id string) (*domain.Post, error)
	Update(ctx context.Context, p *domain.Post) error
}) *MediaHandler {
	return &MediaHandler{storagePath: storagePath, postRepo: postRepo}
}

func (h *MediaHandler) isValidSegment(s string) bool {
	if s == "." || s == ".." {
		return false
	}
	base := filepath.Base(s)
	if base != s {
		return false
	}
	for _, c := range s {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.') {
			return false
		}
	}
	return len(s) > 0
}

// GET /api/media/{tenantId}/{filename} — public, no auth required (cookie-based img src)
func (h *MediaHandler) Serve(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	filename := chi.URLParam(r, "filename")

	if !h.isValidSegment(tenantID) || !h.isValidSegment(filename) {
		http.Error(w, "invalid parameters", http.StatusBadRequest)
		return
	}

	ct, ok := allowedMediaTypes[strings.ToLower(filepath.Ext(filename))]
	if !ok {
		http.NotFound(w, r)
		return
	}

	filePath := filepath.Join(h.storagePath, tenantID, filename)
	f, err := os.Open(filepath.Clean(filePath))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	// Force the served Content-Type to an allowlisted image type and forbid
	// MIME sniffing / inline scripting so stored content can never execute.
	w.Header().Set("Content-Type", ct)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = io.Copy(w, f)
}

// POST /api/media/{tenantId}/{postId} — upload media for a post
func (h *MediaHandler) Upload(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	tenantID := chi.URLParam(r, "tenantId")
	postID := chi.URLParam(r, "postId")

	if !h.isValidSegment(tenantID) {
		UnprocessableEntity(w, "invalid tenant")
		return
	}
	if claims == nil || (claims.TenantID != tenantID && !claims.HasPermission("view-any:tenant")) {
		Forbidden(w)
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		UnprocessableEntity(w, "failed to parse form")
		return
	}

	files := r.MultipartForm.File["file"]
	if len(files) == 0 {
		UnprocessableEntity(w, "no files provided")
		return
	}

	dir := filepath.Join(h.storagePath, tenantID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		InternalError(w)
		return
	}

	var savedNames []string
	for i, fh := range files {
		ext := strings.ToLower(filepath.Ext(fh.Filename))
		if _, ok := allowedMediaTypes[ext]; !ok {
			UnprocessableEntity(w, "unsupported file type")
			return
		}

		src, err := fh.Open()
		if err != nil {
			InternalError(w)
			return
		}

		// Reject markup/text payloads disguised by extension. Serve also pins
		// the Content-Type from allowedMediaTypes, so stored bytes can never be
		// executed regardless — this is defense in depth.
		head := make([]byte, 512)
		n, _ := io.ReadFull(src, head)
		head = head[:n]
		if !isSafeMediaContent(http.DetectContentType(head)) {
			src.Close()
			UnprocessableEntity(w, "unsupported file content")
			return
		}

		var name string
		if len(files) > 1 {
			name = fmt.Sprintf("%s-%02d%s", postID, i+1, ext)
		} else {
			name = postID + ext
		}
		if !h.isValidSegment(name) {
			src.Close()
			InternalError(w)
			return
		}

		dst, err := os.Create(filepath.Join(dir, name))
		if err != nil {
			src.Close()
			InternalError(w)
			return
		}
		_, copyErr := io.Copy(dst, io.MultiReader(bytes.NewReader(head), src))
		src.Close()
		dst.Close()
		if copyErr != nil {
			InternalError(w)
			return
		}
		savedNames = append(savedNames, name)
	}

	// Update post media_path only when the post belongs to this tenant.
	if postID != "" {
		if p, err := h.postRepo.GetByID(r.Context(), postID); err == nil && p.TenantID == tenantID {
			p.MediaPath = &savedNames[0]
			_ = h.postRepo.Update(r.Context(), p)
		}
	}

	JSON(w, http.StatusOK, map[string]any{"media_files": savedNames})
}

// DELETE /api/media/{tenantId}/{postId} — delete media for a post
func (h *MediaHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	tenantID := chi.URLParam(r, "tenantId")
	postID := chi.URLParam(r, "postId")

	if !h.isValidSegment(tenantID) {
		UnprocessableEntity(w, "invalid tenant")
		return
	}
	if claims == nil || (claims.TenantID != tenantID && !claims.HasPermission("view-any:tenant")) {
		Forbidden(w)
		return
	}

	// Clear post media_path and delete the file (only for this tenant's post)
	if postID != "" {
		if p, err := h.postRepo.GetByID(r.Context(), postID); err == nil && p.TenantID == tenantID && p.MediaPath != nil {
			filename := *p.MediaPath
			if h.isValidSegment(filename) {
				filePath := filepath.Join(h.storagePath, tenantID, filename)
				_ = os.Remove(filepath.Clean(filePath))
			}
			p.MediaPath = nil
			_ = h.postRepo.Update(r.Context(), p)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}
