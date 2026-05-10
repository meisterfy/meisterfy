package kimi

import (
	"github.com/rush-maestro/rush-maestro/internal/connector/openai"
)

const kimiAPI = "https://api.moonshot.cn/v1/chat/completions"

type KimiProvider struct {
	*openai.OpenAIProvider
}

func NewKimiProvider(apiKey string) *KimiProvider {
	return &KimiProvider{
		OpenAIProvider: openai.NewOpenAIProviderWithBaseURL(apiKey, kimiAPI),
	}
}

func (p *KimiProvider) Name() string { return "kimi" }
