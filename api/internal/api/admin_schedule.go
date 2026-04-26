package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rush-maestro/rush-maestro/internal/repository"
)

type AdminScheduleHandler struct {
	agentRunRepo interface {
		ListRecent(ctx context.Context, tenantID string, limit int) ([]repository.AgentRun, error)
		GetLast(ctx context.Context, tenantID, agent string) (*repository.AgentRun, error)
	}
}

func NewAdminScheduleHandler(
	agentRunRepo interface {
		ListRecent(ctx context.Context, tenantID string, limit int) ([]repository.AgentRun, error)
		GetLast(ctx context.Context, tenantID, agent string) (*repository.AgentRun, error)
	},
) *AdminScheduleHandler {
	return &AdminScheduleHandler{agentRunRepo: agentRunRepo}
}

type agentRunResponse struct {
	ID         string     `json:"id"`
	TenantID   *string    `json:"tenant_id"`
	Agent      string     `json:"agent"`
	Status     string     `json:"status"`
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
	Summary    *string    `json:"summary"`
	Error      *string    `json:"error"`
}

func toAgentRunResponse(r repository.AgentRun) agentRunResponse {
	return agentRunResponse{
		ID:         r.ID,
		TenantID:   r.TenantID,
		Agent:      r.Agent,
		Status:     r.Status,
		StartedAt:  r.StartedAt,
		FinishedAt: r.FinishedAt,
		Summary:    r.Summary,
		Error:      r.Error,
	}
}

func (h *AdminScheduleHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")

	runs, err := h.agentRunRepo.ListRecent(r.Context(), tenantID, 30)
	if err != nil {
		InternalError(w)
		return
	}

	lastRun, _ := h.agentRunRepo.GetLast(r.Context(), tenantID, "collect-daily-metrics")

	data := make([]agentRunResponse, len(runs))
	for i, run := range runs {
		data[i] = toAgentRunResponse(run)
	}

	var lastRunResp *agentRunResponse
	if lastRun != nil {
		resp := toAgentRunResponse(*lastRun)
		lastRunResp = &resp
	}

	cronCommand := fmt.Sprintf(
		"3 7 * * * cd /home/rafhael/www/html/marketing && bun run scripts/collect-daily-metrics.ts %s >> /tmp/ads-monitor.log 2>&1",
		tenantID,
	)

	JSON(w, http.StatusOK, map[string]any{
		"last_run":     lastRunResp,
		"runs":         data,
		"cron_command": cronCommand,
	})
}
