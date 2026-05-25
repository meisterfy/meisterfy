package kimi

import (
	"github.com/meisterfy/meisterfy/internal/connector"
	"github.com/meisterfy/meisterfy/internal/connector/openai"
)

const kimiAPI = "https://api.moonshot.ai/v1/chat/completions"

const defaultModel = "kimi-k2.6"

type KimiProvider struct { //nolint:revive // name is intentional for clarity across packages
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
