package groq

import (
	"github.com/meisterfy/meisterfy/internal/connector"
	"github.com/meisterfy/meisterfy/internal/connector/openai"
)

const groqAPI = "https://api.groq.com/openai/v1/chat/completions"

const defaultModel = "llama-3.3-70b-versatile"

type GroqProvider struct { //nolint:revive // name is intentional for clarity across packages
	*openai.OpenAIProvider
}

func NewGroqProvider(apiKey string, cfg map[string]any) *GroqProvider {
	return &GroqProvider{
		OpenAIProvider: openai.NewOpenAIProviderWithBaseURL(
			apiKey, groqAPI,
			connector.ConfigString(cfg, "model", defaultModel),
			connector.ConfigFloat(cfg, "temperature", 0.7),
		),
	}
}

func (p *GroqProvider) Name() string { return "groq" }
