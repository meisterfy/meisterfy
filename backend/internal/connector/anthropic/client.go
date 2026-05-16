package anthropic

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/mkt-maestro/mkt-maestro/internal/connector"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
)

const anthropicAPI = "https://api.anthropic.com/v1/messages"

type AnthropicProvider struct { //nolint:revive // name is intentional for clarity across packages
	apiKey             string
	defaultModel       string
	defaultTemperature float64
	client             *http.Client
}

func NewAnthropicProvider(apiKey string, cfg map[string]any) *AnthropicProvider {
	return &AnthropicProvider{
		apiKey:             apiKey,
		defaultModel:       connector.ConfigString(cfg, "model", "claude-3-5-sonnet-20241022"),
		defaultTemperature: connector.ConfigFloat(cfg, "temperature", 0.7),
		client:             &http.Client{},
	}
}

func (p *AnthropicProvider) Name() string { return "claude" }

func (p *AnthropicProvider) Generate(ctx context.Context, req domain.LLMRequest, stream domain.StreamFunc) (*domain.LLMResponse, error) {
	model := req.Model
	if model == "" {
		model = p.defaultModel
	}

	messages := make([]anthropicMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		messages = append(messages, anthropicMessage{
			Role:    string(m.Role),
			Content: []anthropicContent{{Type: "text", Text: m.Content}},
		})
	}

	body := anthropicRequest{
		Model:       model,
		MaxTokens:   domain.DefaultMaxTokens(req.MaxTokens),
		Messages:    messages,
		Temperature: p.defaultTemperature,
		Stream:      true,
	}
	if req.System != "" {
		body.System = req.System
	}

	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicAPI, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("x-api-key", p.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("anthropic api error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result domain.LLMResponse
	result.Model = model

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
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var event anthropicStreamEvent
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}

		if event.Type == "content_block_delta" && event.Delta.Type == "text_delta" {
			chunk := domain.LLMChunk{Content: event.Delta.Text}
			if stream != nil {
				if err := stream(chunk); err != nil {
					return nil, err
				}
			}
			result.Content += event.Delta.Text
		}
		if event.Type == "message_stop" {
			if stream != nil {
				_ = stream(domain.LLMChunk{Done: true})
			}
			break
		}
	}

	return &result, nil
}

type anthropicRequest struct {
	Model       string             `json:"model"`
	MaxTokens   int                `json:"max_tokens"`
	Messages    []anthropicMessage `json:"messages"`
	System      string             `json:"system,omitempty"`
	Temperature float64            `json:"temperature,omitempty"`
	Stream      bool               `json:"stream"`
}

type anthropicMessage struct {
	Role    string             `json:"role"`
	Content []anthropicContent `json:"content"`
}

type anthropicContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type anthropicStreamEvent struct {
	Type  string `json:"type"`
	Delta struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"delta"`
}
