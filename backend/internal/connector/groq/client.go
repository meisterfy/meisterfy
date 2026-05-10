package groq

import (
	"github.com/rush-maestro/rush-maestro/internal/connector/openai"
)

const groqAPI = "https://api.groq.com/openai/v1/chat/completions"

type GroqProvider struct {
	*openai.OpenAIProvider
}

func NewGroqProvider(apiKey string) *GroqProvider {
	return &GroqProvider{
		OpenAIProvider: openai.NewOpenAIProviderWithBaseURL(apiKey, groqAPI),
	}
}

func (p *GroqProvider) Name() string { return "groq" }
