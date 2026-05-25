package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/middleware"
)

type LegalHandler struct {
	repo interface {
		GetLatestVersion(ctx context.Context) (*domain.LegalTermVersion, error)
		GetVersionByID(ctx context.Context, id string) (*domain.LegalTermVersion, error)
		ListVersions(ctx context.Context) ([]domain.LegalTermVersion, error)
		CreateVersion(ctx context.Context, v *domain.LegalTermVersion) error
		UpdateVersion(ctx context.Context, v *domain.LegalTermVersion) error
	}
}

func NewLegalHandler(repo interface {
	GetLatestVersion(ctx context.Context) (*domain.LegalTermVersion, error)
	GetVersionByID(ctx context.Context, id string) (*domain.LegalTermVersion, error)
	ListVersions(ctx context.Context) ([]domain.LegalTermVersion, error)
	CreateVersion(ctx context.Context, v *domain.LegalTermVersion) error
	UpdateVersion(ctx context.Context, v *domain.LegalTermVersion) error
}) *LegalHandler {
	return &LegalHandler{repo: repo}
}

type legalVersionResponse struct {
	ID             string                        `json:"id"`
	Version        int                           `json:"version"`
	FallbackLocale string                        `json:"fallback_locale"`
	Translations   map[string][]domain.TermBlock `json:"translations"`
	EffectiveAt    time.Time                     `json:"effective_at"`
	CreatedAt      time.Time                     `json:"created_at"`
}

func toLegalVersionResponse(v domain.LegalTermVersion) legalVersionResponse {
	return legalVersionResponse{
		ID:             v.ID,
		Version:        v.Version,
		FallbackLocale: v.FallbackLocale,
		Translations:   v.Translations,
		EffectiveAt:    v.EffectiveAt,
		CreatedAt:      v.CreatedAt,
	}
}

func (h *LegalHandler) List(w http.ResponseWriter, r *http.Request) {
	versions, err := h.repo.ListVersions(r.Context())
	if err != nil {
		InternalError(w)
		return
	}
	data := make([]legalVersionResponse, len(versions))
	for i, v := range versions {
		data[i] = toLegalVersionResponse(v)
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

func (h *LegalHandler) Get(w http.ResponseWriter, r *http.Request) {
	v, err := h.repo.GetVersionByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"data": toLegalVersionResponse(*v)})
}

func (h *LegalHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())

	var req struct {
		FallbackLocale string                        `json:"fallback_locale"`
		Translations   map[string][]domain.TermBlock `json:"translations"`
		EffectiveAt    time.Time                     `json:"effective_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if len(req.Translations) == 0 {
		UnprocessableEntity(w, "translations required")
		return
	}
	if req.FallbackLocale == "" {
		req.FallbackLocale = "en"
	}

	v := &domain.LegalTermVersion{
		ID:             domain.NewID(),
		FallbackLocale: req.FallbackLocale,
		Translations:   req.Translations,
		EffectiveAt:    req.EffectiveAt,
		CreatedBy:      &claims.UserID,
	}
	if err := h.repo.CreateVersion(r.Context(), v); err != nil {
		InternalError(w)
		return
	}
	created, err := h.repo.GetVersionByID(r.Context(), v.ID)
	if err != nil {
		InternalError(w)
		return
	}
	JSON(w, http.StatusCreated, map[string]any{"data": toLegalVersionResponse(*created)})
}

func (h *LegalHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	existing, err := h.repo.GetVersionByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	var req struct {
		FallbackLocale string                        `json:"fallback_locale"`
		Translations   map[string][]domain.TermBlock `json:"translations"`
		EffectiveAt    *time.Time                    `json:"effective_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.FallbackLocale != "" {
		existing.FallbackLocale = req.FallbackLocale
	}
	if req.Translations != nil {
		existing.Translations = req.Translations
	}
	if req.EffectiveAt != nil {
		existing.EffectiveAt = *req.EffectiveAt
	}

	if err := h.repo.UpdateVersion(r.Context(), existing); err != nil {
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
