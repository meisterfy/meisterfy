package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/rush-maestro/rush-maestro/internal/connector/llm"
)

// AIGenerateHandler handles POST /ai/generate with SSE streaming.
type AIGenerateHandler struct {
	selector *llm.ProviderSelector
}

// NewAIGenerateHandler creates a new AI generate handler.
func NewAIGenerateHandler(selector *llm.ProviderSelector) *AIGenerateHandler {
	return &AIGenerateHandler{selector: selector}
}

type aiGenerateRequest struct {
	TenantID    string        `json:"tenant_id"`
	TaskType    string        `json:"task_type"`
	Model       string        `json:"model,omitempty"`
	Messages    []llm.Message `json:"messages"`
	Temperature float64       `json:"temperature,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	System      string        `json:"system,omitempty"`
}

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

	llmReq := llm.LLMRequest{
		TenantID:    req.TenantID,
		TaskType:    req.TaskType,
		Model:       req.Model,
		Messages:    req.Messages,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		System:      req.System,
	}

	// Check Accept header for SSE.
	accept := r.Header.Get("Accept")
	if strings.Contains(accept, "text/event-stream") {
		h.streamSSE(ctx, w, candidates, llmReq)
		return
	}

	// Non-streaming: try candidates in order until one succeeds.
	resp, err := h.tryGenerate(ctx, candidates, llmReq, nil)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	JSON(w, http.StatusOK, resp)
}

func (h *AIGenerateHandler) tryGenerate(ctx context.Context, candidates []llm.ProviderCandidate, req llm.LLMRequest, stream llm.StreamFunc) (*llm.LLMResponse, error) {
	var lastErr error
	for _, c := range candidates {
		apiKey := c.Integration.LLMCredentials()
		if apiKey == nil || *apiKey == "" {
			lastErr = fmt.Errorf("provider %s missing credentials", c.Name)
			continue
		}
		p, err := llm.NewProvider(c.Name, *apiKey)
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

func (h *AIGenerateHandler) streamSSE(ctx context.Context, w http.ResponseWriter, candidates []llm.ProviderCandidate, req llm.LLMRequest) {
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
	_, err := h.tryGenerate(ctx, candidates, req, func(chunk llm.LLMChunk) error {
		firstChunk = true
		data, _ := json.Marshal(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
		return nil
	})
	if err != nil {
		// If no data was sent yet, we can safely report the error.
		if !firstChunk {
			errData, _ := json.Marshal(map[string]string{"error": err.Error()})
			fmt.Fprintf(w, "data: %s\n\n", errData)
			flusher.Flush()
			return
		}
		// Otherwise error occurred mid-stream; just send DONE and let client handle truncation.
	}

	fmt.Fprint(w, "data: [DONE]\n\n")
	flusher.Flush()
}


