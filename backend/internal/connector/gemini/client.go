package gemini

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/meisterfy/meisterfy/internal/connector"
	"github.com/meisterfy/meisterfy/internal/domain"
)

const geminiAPI = "https://generativelanguage.googleapis.com/v1beta/models"

type GeminiProvider struct { //nolint:revive // name is intentional for clarity across packages
	apiKey             string
	defaultModel       string
	defaultTemperature float64
	client             *http.Client
}

func NewGeminiProvider(apiKey string, cfg map[string]any) *GeminiProvider {
	return &GeminiProvider{
		apiKey:             apiKey,
		defaultModel:       connector.ConfigString(cfg, "model", "gemini-1.5-flash"),
		defaultTemperature: connector.ConfigFloat(cfg, "temperature", 0.7),
		client:             &http.Client{},
	}
}

func (p *GeminiProvider) Name() string { return "gemini" }

func (p *GeminiProvider) Generate(ctx context.Context, req domain.LLMRequest, stream domain.StreamFunc) (*domain.LLMResponse, error) {
	model := req.Model
	if model == "" {
		model = p.defaultModel
	}

	contents := make([]geminiContent, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := string(m.Role)
		if role == "assistant" {
			role = "model"
		}
		contents = append(contents, geminiContent{
			Role:  role,
			Parts: []geminiPart{{Text: m.Content}},
		})
	}

	body := geminiRequest{
		Contents: contents,
		GenerationConfig: geminiGenerationConfig{
			Temperature:     p.defaultTemperature,
			MaxOutputTokens: domain.DefaultMaxTokens(req.MaxTokens),
		},
	}

	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/%s:streamGenerateContent?alt=sse&key=%s", geminiAPI, model, p.apiKey)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gemini api error %d: %s", resp.StatusCode, string(bodyBytes))
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

		var event geminiStreamEvent
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}

		if len(event.Candidates) > 0 && len(event.Candidates[0].Content.Parts) > 0 {
			text := event.Candidates[0].Content.Parts[0].Text
			if text != "" {
				chunk := domain.LLMChunk{Content: text}
				if stream != nil {
					if err := stream(chunk); err != nil {
						return nil, err
					}
				}
				result.Content += text
			}
		}
		if len(event.Candidates) > 0 && event.Candidates[0].FinishReason != "" {
			if stream != nil {
				_ = stream(domain.LLMChunk{Done: true})
			}
			break
		}
	}

	return &result, nil
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Role  string       `json:"role"`
	Parts []geminiPart `json:"parts"`
}

type geminiGenerationConfig struct {
	Temperature     float64 `json:"temperature,omitempty"`
	MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
}

type geminiRequest struct {
	Contents         []geminiContent        `json:"contents"`
	GenerationConfig geminiGenerationConfig `json:"generationConfig,omitempty"`
}

type geminiStreamEvent struct {
	Candidates []struct {
		Content struct {
			Parts []geminiPart `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
}
