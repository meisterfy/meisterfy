package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/meisterfy/meisterfy/internal/middleware"
	"github.com/meisterfy/meisterfy/internal/repository"
)

type CampaignReportsHandler struct {
	repo *repository.CampaignReportRepository
}

func NewCampaignReportsHandler(repo *repository.CampaignReportRepository) *CampaignReportsHandler {
	return &CampaignReportsHandler{repo: repo}
}

// GET /admin/tenants/{tenantId}/campaigns/{campaignId}/ai-reports?type=instant&limit=10
func (h *CampaignReportsHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID   := chi.URLParam(r, "tenantId")
	campaignID := chi.URLParam(r, "campaignId")
	reportType := r.URL.Query().Get("type")
	if reportType == "" {
		reportType = "instant"
	}
	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}

	reports, err := h.repo.List(r.Context(), tenantID, campaignID, reportType, limit)
	if err != nil {
		slog.Error("list campaign reports failed", "tenant_id", tenantID, "campaign_id", campaignID, "err", err)
		InternalError(w)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"data": reports})
}

type saveReportRequest struct {
	Content    string  `json:"content"`
	ReportType string  `json:"report_type"`
	Model      *string `json:"model"`
}

// POST /admin/tenants/{tenantId}/campaigns/{campaignId}/ai-reports
func (h *CampaignReportsHandler) Save(w http.ResponseWriter, r *http.Request) {
	tenantID   := chi.URLParam(r, "tenantId")
	campaignID := chi.URLParam(r, "campaignId")

	var req saveReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.Content == "" {
		UnprocessableEntity(w, "content is required")
		return
	}
	if req.ReportType == "" {
		req.ReportType = "instant"
	}

	claims := middleware.UserClaimsFromContext(r.Context())
	var generatedBy *string
	if claims != nil {
		s := claims.UserID
		generatedBy = &s
	}

	report, err := h.repo.Save(r.Context(), repository.SaveReportParams{
		TenantID:    tenantID,
		CampaignID:  campaignID,
		ReportType:  req.ReportType,
		Content:     req.Content,
		GeneratedBy: generatedBy,
		Model:       req.Model,
	})
	if err != nil {
		slog.Error("save campaign report failed", "tenant_id", tenantID, "campaign_id", campaignID, "err", err)
		InternalError(w)
		return
	}
	JSON(w, http.StatusCreated, map[string]any{"data": report})
}
