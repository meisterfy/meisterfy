package kimi

import (
	"github.com/mkt-maestro/mkt-maestro/internal/connector"
	"github.com/mkt-maestro/mkt-maestro/internal/connector/openai"
)

const kimiAPI = "https://api.moonshot.ai/v1/chat/completions"

const defaultModel = "kimi-k2.6"

type KimiProvider struct {
	*openai.OpenAIProvider
}

func NewKimiProvider(apiKey string, cfg map[string]any) *KimiProvider {
	return &KimiProvider{
		OpenAIProvider: openai.NewOpenAIProviderWithBaseURL(
			apiKey, kimiAPI,
			connector.ConfigString(cfg, "model", defaultModel),
			1.0, // kimi-k2.6 only accepts temperature=1
		),
	}
}

func (p *KimiProvider) Name() string { return "kimi" }
