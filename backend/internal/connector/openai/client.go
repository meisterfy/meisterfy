package openai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/meisterfy/meisterfy/internal/connector"
	"github.com/meisterfy/meisterfy/internal/domain"
)

const openaiAPI = "https://api.openai.com/v1/chat/completions"

type OpenAIProvider struct { //nolint:revive // name is intentional for clarity across packages
	apiKey             string
	baseURL            string
	defaultModel       string
	defaultTemperature float64
	client             *http.Client
}

func NewOpenAIProvider(apiKey string, cfg map[string]any) *OpenAIProvider {
	return &OpenAIProvider{
		apiKey:             apiKey,
		baseURL:            openaiAPI,
		defaultModel:       connector.ConfigString(cfg, "model", "gpt-4o-mini"),
		defaultTemperature: connector.ConfigFloat(cfg, "temperature", 0.7),
		client:             &http.Client{},
	}
}

// NewOpenAIProviderWithBaseURL is used by providers that embed OpenAIProvider
// (Kimi, Groq) and supply their own base URL, default model, and temperature explicitly.
func NewOpenAIProviderWithBaseURL(apiKey, baseURL, defaultModel string, defaultTemperature float64) *OpenAIProvider {
	return &OpenAIProvider{
		apiKey:             apiKey,
		baseURL:            baseURL,
		defaultModel:       defaultModel,
		defaultTemperature: defaultTemperature,
		client:             &http.Client{},
	}
}

func (p *OpenAIProvider) Name() string { return "openai" }

func (p *OpenAIProvider) Generate(ctx context.Context, req domain.LLMRequest, stream domain.StreamFunc) (*domain.LLMResponse, error) {
	model := req.Model
	if model == "" {
		model = p.defaultModel
	}

	messages := make([]openAIMessage, 0, len(req.Messages))
	if req.System != "" {
		messages = append(messages, openAIMessage{Role: "system", Content: req.System})
	}
	for _, m := range req.Messages {
		messages = append(messages, openAIMessage{Role: string(m.Role), Content: m.Content})
	}

	body := openAIRequest{
		Model:       model,
		Messages:    messages,
		Temperature: p.defaultTemperature,
		MaxTokens:   req.MaxTokens,
		Stream:      true,
	}

	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openai api error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result domain.LLMResponse
	result.Model = model

	// Detect whether the API returned an SSE stream or a plain JSON completion.
	// Some providers (e.g. kimi-k2.6) ignore stream:true for certain models.
	contentType := resp.Header.Get("Content-Type")
	isSSE := strings.Contains(contentType, "text/event-stream")

	if !isSSE {
		// Non-streaming JSON response — buffer and parse directly.
		rawBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}
		slog.Warn("openai provider: non-streaming response (stream:true ignored by provider)", "model", model, "content_type", contentType, "body_len", len(rawBody))
		var nonStream openAINonStreamResponse
		if err := json.Unmarshal(rawBody, &nonStream); err != nil {
			return nil, fmt.Errorf("openai non-streaming parse error: %w", err)
		}
		if nonStream.Error != nil {
			return nil, fmt.Errorf("provider error: %s", nonStream.Error.Message)
		}
		if len(nonStream.Choices) > 0 {
			content := nonStream.Choices[0].Message.Content
			result.Content = content
			if stream != nil && content != "" {
				_ = stream(domain.LLMChunk{Content: content})
				_ = stream(domain.LLMChunk{Done: true})
			}
		}
		return &result, nil
	}

	// SSE streaming response — read and parse incrementally.
	var sseEvents, contentEvents int
	reader := bufio.NewReader(resp.Body)
	for {
		line, err := reader.ReadString('\n')
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		sseEvents++
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			if stream != nil {
				_ = stream(domain.LLMChunk{Done: true})
			}
			break
		}

		var event openAIStreamEvent
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}

		if event.Error != nil {
			return nil, fmt.Errorf("provider error: %s", event.Error.Message)
		}

		if len(event.Choices) > 0 {
			delta := event.Choices[0].Delta.Content
			if delta != "" {
				contentEvents++
				chunk := domain.LLMChunk{Content: delta}
				if stream != nil {
					if err := stream(chunk); err != nil {
						return nil, err
					}
				}
				result.Content += delta
			}
			if event.Choices[0].FinishReason != "" && result.Content != "" {
				if stream != nil {
					_ = stream(domain.LLMChunk{Done: true})
				}
				break
			}
		}
	}

	if contentEvents == 0 {
		slog.Warn("openai provider: SSE stream had no content events", "model", model, "sse_events", sseEvents)
	} else {
		slog.Info("openai provider: stream finished", "model", model, "sse_events", sseEvents, "content_events", contentEvents, "content_len", len(result.Content))
	}
	return &result, nil
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIRequest struct {
	Model       string          `json:"model"`
	Messages    []openAIMessage `json:"messages"`
	Temperature float64         `json:"temperature,omitempty"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
	Stream      bool            `json:"stream"`
}

type openAIStreamEvent struct {
	Choices []struct {
		Delta struct {
			Content          string `json:"content"`
			ReasoningContent string `json:"reasoning_content"` // thinking models (kimi-k2.6, o1, etc.)
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}

// openAINonStreamResponse handles providers that return a plain JSON completion
// despite receiving stream:true (e.g. kimi-k2.6 in some configurations).
type openAINonStreamResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}
