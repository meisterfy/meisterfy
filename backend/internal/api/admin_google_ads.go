package api

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/sync/errgroup"
	"github.com/mkt-maestro/mkt-maestro/internal/connector/googleads"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/repository"
)

type AdminGoogleAdsHandler struct {
	integrationRepo interface {
		GetForTenant(ctx context.Context, tenantID, provider string) (*domain.Integration, error)
	}
	resourceRepo interface {
		List(ctx context.Context, tenantID string, provider domain.IntegrationProvider, resourceType string) ([]*domain.ConnectorResource, error)
	}
	tenantRepo interface {
		GetByID(ctx context.Context, id string) (*domain.Tenant, error)
	}
	metricsRepo *repository.MetricsRepository
	alertRepo   *repository.AlertRepository
}

func NewAdminGoogleAdsHandler(
	integrationRepo interface {
		GetForTenant(ctx context.Context, tenantID, provider string) (*domain.Integration, error)
	},
	resourceRepo interface {
		List(ctx context.Context, tenantID string, provider domain.IntegrationProvider, resourceType string) ([]*domain.ConnectorResource, error)
	},
	tenantRepo interface {
		GetByID(ctx context.Context, id string) (*domain.Tenant, error)
	},
	metricsRepo *repository.MetricsRepository,
	alertRepo *repository.AlertRepository,
) *AdminGoogleAdsHandler {
	return &AdminGoogleAdsHandler{
		integrationRepo: integrationRepo,
		resourceRepo:    resourceRepo,
		tenantRepo:      tenantRepo,
		metricsRepo:     metricsRepo,
		alertRepo:       alertRepo,
	}
}

// buildClient resolves Google Ads credentials and returns a ready-to-use client
// along with the integration ID (for use as client.id in responses).
// Prefers a connector_resource ad_account if one is configured; falls back to
// login_customer_id for direct account access without connector_resources.
func (h *AdminGoogleAdsHandler) buildClient(ctx context.Context, tenantID string) (*googleads.Client, string, error) {
	integration, err := h.integrationRepo.GetForTenant(ctx, tenantID, string(domain.ProviderGoogleAds))
	if err != nil {
		return nil, "", fmt.Errorf("no google_ads integration for tenant %s", tenantID)
	}
	creds := integration.GoogleAdsCredentials()
	if creds == nil || creds.RefreshToken == "" {
		return nil, "", fmt.Errorf("google_ads integration for tenant %s has no credentials", tenantID)
	}
	customerID := creds.LoginCustomerID
	if resources, _ := h.resourceRepo.List(ctx, tenantID, domain.ProviderGoogleAds, "ad_account"); len(resources) > 0 {
		customerID = resources[0].ResourceID
	}
	if customerID == "" {
		return nil, "", fmt.Errorf("no customer ID for google_ads on tenant %s", tenantID)
	}
	return googleads.NewClient(customerID, *creds), integration.ID, nil
}

// GET /admin/tenants/{tenantId}/campaigns/live
func (h *AdminGoogleAdsHandler) LiveCampaigns(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	client, _, err := h.buildClient(r.Context(), tenantID)
	if err != nil {
		JSON(w, http.StatusOK, map[string]any{"data": []any{}})
		return
	}

	campaigns, err := client.GetLiveMetrics(r.Context())
	if err != nil {
		InternalError(w)
		return
	}

	JSON(w, http.StatusOK, map[string]any{"data": campaigns})
}

// GET /admin/tenants/{tenantId}/campaigns/live/{campaignId}?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
func (h *AdminGoogleAdsHandler) LiveCampaignDetail(w http.ResponseWriter, r *http.Request) {
	tenantID   := chi.URLParam(r, "tenantId")
	campaignID := chi.URLParam(r, "campaignId")
	startDate  := r.URL.Query().Get("startDate")
	endDate    := r.URL.Query().Get("endDate")

	client, integrationID, err := h.buildClient(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}

	g, ctx := errgroup.WithContext(r.Context())
	var (
		detail *googleads.CampaignDetail
		wow    *googleads.WoWMetrics
		pacing *googleads.BudgetPacingInfo
		alerts []repository.AlertEvent
	)

	g.Go(func() error {
		var err error
		detail, err = client.GetCampaignDetail(ctx, campaignID, startDate, endDate)
		return err
	})
	g.Go(func() error {
		var err error
		wow, err = client.GetWoW(ctx, campaignID)
		return err
	})
	g.Go(func() error {
		var err error
		pacing, err = client.GetBudgetPacing(ctx, campaignID)
		return err
	})
	g.Go(func() error {
		var err error
		alerts, err = h.alertRepo.ListOpen(ctx, tenantID)
		return err
	})

	if err := g.Wait(); err != nil {
		InternalError(w)
		return
	}

	// Build nested ad groups expected by the frontend
	type adGroupMetrics struct {
		Impressions float64 `json:"impressions"`
		Clicks      float64 `json:"clicks"`
		Cost        string  `json:"cost"`
		Conversions float64 `json:"conversions"`
	}
	type adGroupResp struct {
		ID      string         `json:"id"`
		Name    string         `json:"name"`
		Status  string         `json:"status"`
		Metrics adGroupMetrics `json:"metrics"`
	}
	adGroups := make([]adGroupResp, len(detail.AdGroups))
	for i, ag := range detail.AdGroups {
		adGroups[i] = adGroupResp{
			ID:     ag.ID,
			Name:   ag.Name,
			Status: ag.Status,
			Metrics: adGroupMetrics{
				Impressions: ag.Impressions,
				Clicks:      ag.Clicks,
				Cost:        ag.Cost,
				Conversions: ag.Conversions,
			},
		}
	}

	// Collect open alerts for this campaign only
	type alertResp struct {
		ID      string `json:"id"`
		Level   string `json:"level"`
		Type    string `json:"type"`
		Message string `json:"message"`
	}
	var openAlerts []alertResp
	for _, a := range alerts {
		if a.CampaignID != nil && *a.CampaignID == campaignID {
			openAlerts = append(openAlerts, alertResp{
				ID:      a.ID,
				Level:   a.Level,
				Type:    a.Type,
				Message: a.Message,
			})
		}
	}
	if openAlerts == nil {
		openAlerts = []alertResp{}
	}

	JSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"campaign": map[string]any{
				"id":           detail.ID,
				"name":         detail.Name,
				"status":       detail.Status,
				"strategy":     detail.Strategy,
				"budgetMicros": detail.BudgetMicros,
				"metrics":      detail.Metrics,
				"history":      detail.History,
				"adGroups":     adGroups,
			},
			"wow":           wow,
			"budgetPacing":  pacing,
			"client":        map[string]any{"id": integrationID},
			"openAlerts":    openAlerts,
		},
	})
}

// GET /admin/tenants/{tenantId}/metrics?days=180&campaign_id=X
func (h *AdminGoogleAdsHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	tenantID   := chi.URLParam(r, "tenantId")
	campaignID := r.URL.Query().Get("campaign_id")

	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 || days > 365 {
		days = 180
	}

	since := time.Now().AddDate(0, 0, -days)
	metrics, err := h.metricsRepo.GetHistory(r.Context(), tenantID, since)
	if err != nil {
		InternalError(w)
		return
	}

	if campaignID != "" {
		filtered := make([]repository.DailyMetric, 0, len(metrics))
		for _, m := range metrics {
			if m.CampaignID == campaignID {
				filtered = append(filtered, m)
			}
		}
		metrics = filtered
	}

	type metricRow struct {
		Date       string  `json:"date"`
		CampaignID string  `json:"campaign_id"`
		Cost       float64 `json:"cost"`
		Conversions float64 `json:"conversions"`
		Clicks     int32   `json:"clicks"`
		Impressions int32  `json:"impressions"`
		CPA        float64 `json:"cpa"`
	}
	result := make([]metricRow, len(metrics))
	for i, m := range metrics {
		cpa := 0.0
		if m.CPABRL != nil {
			cpa = *m.CPABRL
		}
		result[i] = metricRow{
			Date:        m.Date.Format("2006-01-02"),
			CampaignID:  m.CampaignID,
			Cost:        m.CostBRL,
			Conversions: m.Conversions,
			Clicks:      m.Clicks,
			Impressions: m.Impressions,
			CPA:         cpa,
		}
	}

	JSON(w, http.StatusOK, map[string]any{"data": result})
}

// GET /admin/tenants/{tenantId}/campaigns/live/{campaignId}/devices
func (h *AdminGoogleAdsHandler) LiveCampaignDevices(w http.ResponseWriter, r *http.Request) {
	tenantID   := chi.URLParam(r, "tenantId")
	campaignID := chi.URLParam(r, "campaignId")
	startDate  := r.URL.Query().Get("startDate")
	endDate    := r.URL.Query().Get("endDate")

	client, _, err := h.buildClient(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}

	devices, err := client.GetDeviceBreakdown(r.Context(), campaignID, startDate, endDate)
	if err != nil {
		InternalError(w)
		return
	}

	JSON(w, http.StatusOK, map[string]any{"data": devices})
}

// GET /admin/tenants/{tenantId}/campaigns/live/{campaignId}/hourly
func (h *AdminGoogleAdsHandler) LiveCampaignHourly(w http.ResponseWriter, r *http.Request) {
	tenantID   := chi.URLParam(r, "tenantId")
	campaignID := chi.URLParam(r, "campaignId")
	startDate  := r.URL.Query().Get("startDate")
	endDate    := r.URL.Query().Get("endDate")

	client, _, err := h.buildClient(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}

	hourly, err := client.GetHourlyBreakdown(r.Context(), campaignID, startDate, endDate)
	if err != nil {
		InternalError(w)
		return
	}

	JSON(w, http.StatusOK, map[string]any{"data": hourly})
}

// GET /admin/tenants/{tenantId}/campaigns/live/{campaignId}/impression-share
func (h *AdminGoogleAdsHandler) LiveCampaignImpressionShare(w http.ResponseWriter, r *http.Request) {
	tenantID   := chi.URLParam(r, "tenantId")
	campaignID := chi.URLParam(r, "campaignId")
	startDate  := r.URL.Query().Get("startDate")
	endDate    := r.URL.Query().Get("endDate")

	client, _, err := h.buildClient(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}

	stats, err := client.GetImpressionShare(r.Context(), campaignID, startDate, endDate)
	if err != nil {
		InternalError(w)
		return
	}

	JSON(w, http.StatusOK, map[string]any{"data": stats})
}

// GET /admin/tenants/{tenantId}/campaigns/live/{campaignId}/search-terms
func (h *AdminGoogleAdsHandler) LiveCampaignSearchTerms(w http.ResponseWriter, r *http.Request) {
	tenantID   := chi.URLParam(r, "tenantId")
	campaignID := chi.URLParam(r, "campaignId")
	startDate  := r.URL.Query().Get("startDate")
	endDate    := r.URL.Query().Get("endDate")

	client, _, err := h.buildClient(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}

	terms, err := client.GetSearchTerms(r.Context(), campaignID, startDate, endDate)
	if err != nil {
		InternalError(w)
		return
	}

	JSON(w, http.StatusOK, map[string]any{"data": terms})
}

// GET /admin/tenants/{tenantId}/campaigns/live/{campaignId}/quality-scores
func (h *AdminGoogleAdsHandler) LiveCampaignQualityScores(w http.ResponseWriter, r *http.Request) {
	tenantID   := chi.URLParam(r, "tenantId")
	campaignID := chi.URLParam(r, "campaignId")

	client, _, err := h.buildClient(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}

	scores, err := client.GetKeywordQualityScores(r.Context(), campaignID)
	if err != nil {
		InternalError(w)
		return
	}

	JSON(w, http.StatusOK, map[string]any{"data": scores})
}

// GET /admin/tenants/{tenantId}/campaigns/live/{campaignId}/keywords
func (h *AdminGoogleAdsHandler) LiveCampaignKeywords(w http.ResponseWriter, r *http.Request) {
	tenantID   := chi.URLParam(r, "tenantId")
	campaignID := chi.URLParam(r, "campaignId")
	startDate  := r.URL.Query().Get("startDate")
	endDate    := r.URL.Query().Get("endDate")

	client, _, err := h.buildClient(r.Context(), tenantID)
	if err != nil {
		InternalError(w)
		return
	}

	keywords, err := client.GetKeywordPerformance(r.Context(), campaignID, startDate, endDate)
	if err != nil {
		slog.Error("LiveCampaignKeywords failed", "tenant", tenantID, "campaign", campaignID, "err", err)
		InternalError(w)
		return
	}

	JSON(w, http.StatusOK, map[string]any{"data": keywords})
}

// GET /admin/tenants/{tenantId}/google-ads/status
// Returns whether Google Ads is properly connected and configured for this tenant.
func (h *AdminGoogleAdsHandler) Status(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	_, _, err := h.buildClient(r.Context(), tenantID)
	JSON(w, http.StatusOK, map[string]any{"data": map[string]any{"connected": err == nil}})
}

// POST /admin/tenants/{tenantId}/campaigns/sync-history
func (h *AdminGoogleAdsHandler) SyncHistory(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	tenant, err := h.tenantRepo.GetByID(r.Context(), tenantID)
	if err != nil {
		NotFound(w)
		return
	}

	client, _, err := h.buildClient(r.Context(), tenantID)
	if err != nil {
		JSON(w, http.StatusUnprocessableEntity, map[string]any{"error": "no google ads integration configured for this tenant"})
		return
	}

	result, err := googleads.SyncHistory(r.Context(), client, tenant, 180, h.metricsRepo)
	if err != nil {
		InternalError(w)
		return
	}

	JSON(w, http.StatusOK, map[string]any{"data": result})
}
