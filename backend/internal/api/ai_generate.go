package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/provider/llm"
)

type llmSelectorIface interface {
	ResolveAll(ctx context.Context, tenantID string) []llm.ProviderCandidate
}

// AIGenerateHandler handles POST /ai/generate with SSE streaming.
type AIGenerateHandler struct {
	selector llmSelectorIface
	gen      func(ctx context.Context, candidates []llm.ProviderCandidate, req domain.LLMRequest, stream domain.StreamFunc) (*domain.LLMResponse, error)
}

func NewAIGenerateHandler(selector *llm.ProviderSelector) *AIGenerateHandler {
	h := &AIGenerateHandler{selector: selector}
	h.gen = h.tryGenerate
	return h
}

type aiGenerateRequest struct {
	TenantID    string           `json:"tenant_id"`
	TaskType    string           `json:"task_type"`
	Provider    string           `json:"provider,omitempty"`
	Model       string           `json:"model,omitempty"`
	Messages    []domain.Message `json:"messages"`
	Temperature float64          `json:"temperature,omitempty"`
	MaxTokens   int              `json:"max_tokens,omitempty"`
	System      string           `json:"system,omitempty"`
}

// GET /admin/tenants/{tenantId}/ai/providers
// Returns the list of connected LLM providers available for the given tenant.
func (h *AIGenerateHandler) ListProviders(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	candidates := h.selector.ResolveAll(r.Context(), tenantID)

	type providerInfo struct {
		Name string `json:"name"`
	}
	out := make([]providerInfo, 0, len(candidates))
	for _, c := range candidates {
		out = append(out, providerInfo{Name: c.Name})
	}
	JSON(w, http.StatusOK, map[string]any{"data": out})
}

// POST /ai/generate
func (h *AIGenerateHandler) Generate(w http.ResponseWriter, r *http.Request) {
	var req aiGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.TenantID == "" {
		UnprocessableEntity(w, "tenant_id is required")
		return
	}
	if len(req.Messages) == 0 {
		UnprocessableEntity(w, "messages are required")
		return
	}

	ctx := r.Context()
	candidates := h.selector.ResolveAll(ctx, req.TenantID)
	if len(candidates) == 0 {
		Error(w, http.StatusServiceUnavailable, "no connected llm provider available")
		return
	}

	// If a specific provider is requested, filter to just that one.
	if req.Provider != "" {
		filtered := candidates[:0]
		for _, c := range candidates {
			if c.Name == req.Provider {
				filtered = append(filtered, c)
				break
			}
		}
		if len(filtered) == 0 {
			Error(w, http.StatusServiceUnavailable, "requested llm provider not connected: "+req.Provider)
			return
		}
		candidates = filtered
	}

	// When no explicit model requested, resolve from integration config by task type.
	// LLM integrations may set chat_model for fast conversational responses.
	resolvedModel := req.Model
	if resolvedModel == "" && len(candidates) > 0 {
		cfg := candidates[0].Integration.Config
		switch req.TaskType {
		case "chat":
			if m, _ := cfg["chat_model"].(string); m != "" {
				resolvedModel = m
			}
		}
	}

	llmReq := domain.LLMRequest{
		TenantID:    req.TenantID,
		TaskType:    req.TaskType,
		Model:       resolvedModel,
		Messages:    req.Messages,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		System:      req.System,
	}

	accept := r.Header.Get("Accept")
	if strings.Contains(accept, "text/event-stream") {
		h.streamSSE(ctx, w, candidates, llmReq)
		return
	}

	resp, err := h.gen(ctx, candidates, llmReq, nil)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	JSON(w, http.StatusOK, resp)
}

func (h *AIGenerateHandler) tryGenerate(ctx context.Context, candidates []llm.ProviderCandidate, req domain.LLMRequest, stream domain.StreamFunc) (*domain.LLMResponse, error) {
	var lastErr error
	for _, c := range candidates {
		apiKey := c.Integration.LLMCredentials()
		if apiKey == nil || *apiKey == "" {
			lastErr = fmt.Errorf("provider %s missing credentials", c.Name)
			continue
		}
		p, err := llm.NewProvider(c.Name, *apiKey, c.Integration.Config)
		if err != nil {
			lastErr = err
			continue
		}
		resp, err := p.Generate(ctx, req, stream)
		if err != nil {
			lastErr = err
			continue
		}
		return resp, nil
	}
	if lastErr != nil {
		return nil, fmt.Errorf("all llm providers failed: %w", lastErr)
	}
	return nil, fmt.Errorf("all llm providers failed")
}

func (h *AIGenerateHandler) streamSSE(ctx context.Context, w http.ResponseWriter, candidates []llm.ProviderCandidate, req domain.LLMRequest) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	var firstChunk bool
	_, err := h.gen(ctx, candidates, req, func(chunk domain.LLMChunk) error {
		firstChunk = true
		data, _ := json.Marshal(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
		return nil
	})
	if err != nil {
		if !firstChunk {
			errData, _ := json.Marshal(map[string]string{"error": err.Error()})
			fmt.Fprintf(w, "data: %s\n\n", errData)
			flusher.Flush()
			return
		}
	}

	fmt.Fprint(w, "data: [DONE]\n\n")
	flusher.Flush()
}
