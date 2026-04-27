package api

import (
	"context"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rush-maestro/rush-maestro/internal/domain"
)

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

	filePath := filepath.Join(h.storagePath, tenantID, filename)
	f, err := os.Open(filepath.Clean(filePath))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	ext := strings.ToLower(filepath.Ext(filename))
	ct := mime.TypeByExtension(ext)
	if ct == "" {
		ct = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = io.Copy(w, f)
}

// POST /api/media/{tenantId}/{postId} — upload media for a post
func (h *MediaHandler) Upload(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	postID := chi.URLParam(r, "postId")

	if !h.isValidSegment(tenantID) {
		UnprocessableEntity(w, "invalid tenant")
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
		ext := filepath.Ext(fh.Filename)
		if ext == "" {
			ext = ".jpg"
		}
		var name string
		if len(files) > 1 {
			name = fmt.Sprintf("%s-%02d%s", postID, i+1, ext)
		} else {
			name = postID + ext
		}
		if !h.isValidSegment(name) {
			InternalError(w)
			return
		}

		src, err := fh.Open()
		if err != nil {
			InternalError(w)
			return
		}
		dst, err := os.Create(filepath.Join(dir, name))
		if err != nil {
			src.Close()
			InternalError(w)
			return
		}
		_, copyErr := io.Copy(dst, src)
		src.Close()
		dst.Close()
		if copyErr != nil {
			InternalError(w)
			return
		}
		savedNames = append(savedNames, name)
	}

	// Update post media_path with first file if postId provided and exists
	if postID != "" {
		if p, err := h.postRepo.GetByID(r.Context(), postID); err == nil {
			p.MediaPath = &savedNames[0]
			_ = h.postRepo.Update(r.Context(), p)
		}
	}

	JSON(w, http.StatusOK, map[string]any{"media_files": savedNames})
}

// DELETE /api/media/{tenantId}/{postId} — delete media for a post
func (h *MediaHandler) Delete(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	postID := chi.URLParam(r, "postId")

	if !h.isValidSegment(tenantID) {
		UnprocessableEntity(w, "invalid tenant")
		return
	}

	// Clear post media_path and delete the file
	if postID != "" {
		if p, err := h.postRepo.GetByID(r.Context(), postID); err == nil && p.MediaPath != nil {
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
