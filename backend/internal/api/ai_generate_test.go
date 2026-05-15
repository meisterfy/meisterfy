package api

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/provider/llm"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- mocks ---

type mockLLMSelector struct {
	candidates []llm.ProviderCandidate
}

func (m *mockLLMSelector) ResolveAll(_ context.Context, _ string) []llm.ProviderCandidate {
	return m.candidates
}

// flushRecorder wraps httptest.ResponseRecorder to implement http.Flusher.
type flushRecorder struct {
	*httptest.ResponseRecorder
}

func (f *flushRecorder) Flush() {}

// --- helpers ---

func sampleCandidate() llm.ProviderCandidate {
	apiKey := "sk-test"
	return llm.ProviderCandidate{
		Name: "claude",
		Integration: &domain.Integration{
			ID:                "ig-1",
			Provider:          domain.ProviderClaude,
			Group:             domain.GroupLLM,
			Status:            domain.StatusConnected,
			OAuthClientSecret: &apiKey,
			Config:            map[string]any{},
		},
	}
}

func validGenerateBody() map[string]any {
	return map[string]any{
		"tenant_id": "tenant-1",
		"messages": []map[string]any{
			{"role": "user", "content": "Hello"},
		},
	}
}

func newAIGenerateHandler(selector *mockLLMSelector, genFn func(context.Context, []llm.ProviderCandidate, domain.LLMRequest, domain.StreamFunc) (*domain.LLMResponse, error)) *AIGenerateHandler {
	return &AIGenerateHandler{selector: selector, gen: genFn}
}

// parseSSELines extracts "data: ..." values from an SSE response body.
func parseSSELines(body string) []string {
	var out []string
	scanner := bufio.NewScanner(strings.NewReader(body))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			out = append(out, strings.TrimPrefix(line, "data: "))
		}
	}
	return out
}

// --- Tests ---

func TestAIGenerate_MissingTenantID(t *testing.T) {
	t.Parallel()
	h := newAIGenerateHandler(&mockLLMSelector{}, nil)

	body := map[string]any{"messages": []map[string]any{{"role": "user", "content": "hi"}}}
	w := httptest.NewRecorder()
	h.Generate(w, httptest.NewRequest(http.MethodPost, "/ai/generate", jsonBody(body)))

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAIGenerate_EmptyMessages(t *testing.T) {
	t.Parallel()
	h := newAIGenerateHandler(&mockLLMSelector{}, nil)

	body := map[string]any{"tenant_id": "tenant-1", "messages": []map[string]any{}}
	w := httptest.NewRecorder()
	h.Generate(w, httptest.NewRequest(http.MethodPost, "/ai/generate", jsonBody(body)))

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestAIGenerate_NoProvider(t *testing.T) {
	t.Parallel()
	// Selector returns no candidates → 503.
	h := newAIGenerateHandler(&mockLLMSelector{candidates: []llm.ProviderCandidate{}}, nil)

	w := httptest.NewRecorder()
	h.Generate(w, httptest.NewRequest(http.MethodPost, "/ai/generate", jsonBody(validGenerateBody())))

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestAIGenerate_StreamsSSE(t *testing.T) {
	t.Parallel()
	chunks := []domain.LLMChunk{
		{Content: "Hello", Done: false},
		{Content: " world", Done: true},
	}
	h := newAIGenerateHandler(
		&mockLLMSelector{candidates: []llm.ProviderCandidate{sampleCandidate()}},
		func(_ context.Context, _ []llm.ProviderCandidate, _ domain.LLMRequest, stream domain.StreamFunc) (*domain.LLMResponse, error) {
			for _, c := range chunks {
				if err := stream(c); err != nil {
					return nil, err
				}
			}
			return &domain.LLMResponse{Content: "Hello world"}, nil
		},
	)

	r := httptest.NewRequest(http.MethodPost, "/ai/generate", jsonBody(validGenerateBody()))
	r.Header.Set("Accept", "text/event-stream")
	w := &flushRecorder{ResponseRecorder: httptest.NewRecorder()}
	h.Generate(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "text/event-stream")

	lines := parseSSELines(w.Body.String())
	// Two chunks + [DONE]
	require.GreaterOrEqual(t, len(lines), 3)
	assert.Equal(t, "[DONE]", lines[len(lines)-1])

	// Parse first chunk and verify content
	var chunk domain.LLMChunk
	require.NoError(t, json.Unmarshal([]byte(lines[0]), &chunk))
	assert.Equal(t, "Hello", chunk.Content)
}

func TestAIGenerate_NonSSE_Success(t *testing.T) {
	t.Parallel()
	h := newAIGenerateHandler(
		&mockLLMSelector{candidates: []llm.ProviderCandidate{sampleCandidate()}},
		func(_ context.Context, _ []llm.ProviderCandidate, _ domain.LLMRequest, _ domain.StreamFunc) (*domain.LLMResponse, error) {
			return &domain.LLMResponse{Content: "hello world"}, nil
		},
	)

	// No Accept: text/event-stream → JSON response path.
	w := httptest.NewRecorder()
	h.Generate(w, httptest.NewRequest(http.MethodPost, "/ai/generate", jsonBody(validGenerateBody())))

	require.Equal(t, http.StatusOK, w.Code)
	var resp domain.LLMResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "hello world", resp.Content)
}

func TestAIGenerate_NonSSE_GenerateError(t *testing.T) {
	t.Parallel()
	h := newAIGenerateHandler(
		&mockLLMSelector{candidates: []llm.ProviderCandidate{sampleCandidate()}},
		func(_ context.Context, _ []llm.ProviderCandidate, _ domain.LLMRequest, _ domain.StreamFunc) (*domain.LLMResponse, error) {
			return nil, errors.New("upstream failure")
		},
	)

	w := httptest.NewRecorder()
	h.Generate(w, httptest.NewRequest(http.MethodPost, "/ai/generate", jsonBody(validGenerateBody())))

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestAIGenerate_ListProviders(t *testing.T) {
	t.Parallel()
	h := &AIGenerateHandler{
		selector: &mockLLMSelector{candidates: []llm.ProviderCandidate{sampleCandidate()}},
	}

	r := withChiParam(httptest.NewRequest(http.MethodGet, "/", nil), "tenantId", "tenant-1")
	w := httptest.NewRecorder()
	h.ListProviders(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].([]any)
	assert.Len(t, data, 1)
	assert.Equal(t, "claude", data[0].(map[string]any)["name"])
}

func TestAIGenerate_ProviderFilter_Found(t *testing.T) {
	t.Parallel()
	h := newAIGenerateHandler(
		&mockLLMSelector{candidates: []llm.ProviderCandidate{sampleCandidate()}},
		func(_ context.Context, _ []llm.ProviderCandidate, _ domain.LLMRequest, _ domain.StreamFunc) (*domain.LLMResponse, error) {
			return &domain.LLMResponse{Content: "ok"}, nil
		},
	)

	body := map[string]any{
		"tenant_id": "tenant-1",
		"provider":  "claude",
		"messages":  []map[string]any{{"role": "user", "content": "hi"}},
	}
	w := httptest.NewRecorder()
	h.Generate(w, httptest.NewRequest(http.MethodPost, "/ai/generate", jsonBody(body)))

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAIGenerate_ProviderFilter_NotFound(t *testing.T) {
	t.Parallel()
	// Provider "openai" requested but only "claude" is connected → 503.
	h := newAIGenerateHandler(
		&mockLLMSelector{candidates: []llm.ProviderCandidate{sampleCandidate()}},
		nil,
	)

	body := map[string]any{
		"tenant_id": "tenant-1",
		"provider":  "openai",
		"messages":  []map[string]any{{"role": "user", "content": "hi"}},
	}
	w := httptest.NewRecorder()
	h.Generate(w, httptest.NewRequest(http.MethodPost, "/ai/generate", jsonBody(body)))

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestAIGenerate_ChatModelResolution(t *testing.T) {
	t.Parallel()
	// task_type=chat with chat_model in config → resolvedModel picks the config value.
	candidate := sampleCandidate()
	candidate.Integration.Config = map[string]any{"chat_model": "claude-haiku-4-5"}

	var capturedModel string
	h := newAIGenerateHandler(
		&mockLLMSelector{candidates: []llm.ProviderCandidate{candidate}},
		func(_ context.Context, _ []llm.ProviderCandidate, req domain.LLMRequest, _ domain.StreamFunc) (*domain.LLMResponse, error) {
			capturedModel = req.Model
			return &domain.LLMResponse{Content: "ok", Model: req.Model}, nil
		},
	)

	body := map[string]any{
		"tenant_id": "tenant-1",
		"task_type": "chat",
		"messages":  []map[string]any{{"role": "user", "content": "hi"}},
	}
	w := httptest.NewRecorder()
	h.Generate(w, httptest.NewRequest(http.MethodPost, "/ai/generate", jsonBody(body)))

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "claude-haiku-4-5", capturedModel)
}

func TestAIGenerate_ContextCancelled(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithCancel(context.Background())

	h := newAIGenerateHandler(
		&mockLLMSelector{candidates: []llm.ProviderCandidate{sampleCandidate()}},
		func(ctx context.Context, _ []llm.ProviderCandidate, _ domain.LLMRequest, _ domain.StreamFunc) (*domain.LLMResponse, error) {
			cancel()
			return nil, ctx.Err()
		},
	)

	r := httptest.NewRequest(http.MethodPost, "/ai/generate", jsonBody(validGenerateBody()))
	r = r.WithContext(ctx)
	r.Header.Set("Accept", "text/event-stream")
	w := &flushRecorder{ResponseRecorder: httptest.NewRecorder()}
	h.Generate(w, r)

	// Headers were written before gen is called, so status is always 200 for SSE.
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "text/event-stream")

	// Error frame written because no chunks were produced before cancellation.
	lines := parseSSELines(w.Body.String())
	require.NotEmpty(t, lines)
	var errFrame map[string]string
	require.NoError(t, json.Unmarshal([]byte(lines[0]), &errFrame))
	assert.NotEmpty(t, errFrame["error"])
}
