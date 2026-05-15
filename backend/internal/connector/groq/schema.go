package groq

import (
	"context"
	_ "embed"

	"github.com/mkt-maestro/mkt-maestro/internal/connector"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
)

//go:embed logo.svg
var logoSVG string

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderGroq,
		Group:       domain.GroupLLM,
		DisplayName: "Groq",
		Description: "Fast inference using Groq's LPU acceleration.",
		LogoSVG:     logoSVG,
		ConfigFields: []connector.FieldSchema{
			{
				Key: "model", Label: "Analysis Model", Type: connector.FieldTypeSelect, Required: false,
				HelpText: "Model used for deep analysis and AI reports.",
				Options: []connector.SelectOption{
					{Label: "Llama 3.3 70B (recommended)", Value: "llama-3.3-70b-versatile"},
					{Label: "Llama 3.1 8B", Value: "llama-3.1-8b-instant"},
					{Label: "Mixtral 8x7B", Value: "mixtral-8x7b-32768"},
					{Label: "Gemma 2 9B", Value: "gemma2-9b-it"},
				},
			},
			{
				Key: "chat_model", Label: "Chat Model", Type: connector.FieldTypeSelect, Required: false,
				HelpText: "Faster model for real-time chat. Defaults to Analysis Model if not set.",
				Options: []connector.SelectOption{
					{Label: "Same as Analysis Model (default)", Value: ""},
					{Label: "Llama 3.1 8B (fastest)", Value: "llama-3.1-8b-instant"},
					{Label: "Gemma 2 9B", Value: "gemma2-9b-it"},
					{Label: "Llama 3.3 70B", Value: "llama-3.3-70b-versatile"},
				},
			},
			{
				Key: "temperature", Label: "Temperature", Type: connector.FieldTypeSelect, Required: false,
				HelpText: "Controls randomness. Lower values are more focused; higher values are more creative.",
				Options: []connector.SelectOption{
					{Label: "Balanced 0.7 (recommended)", Value: "0.7"},
					{Label: "Precise 0.3", Value: "0.3"},
					{Label: "Creative 1.0", Value: "1.0"},
				},
			},
		},
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true},
		},
		TestConnection: func(ctx context.Context, ig *domain.Integration) error {
			if ig.OAuthClientSecret == nil || *ig.OAuthClientSecret == "" {
				return domain.ErrMissingCredentials
			}
			p := NewGroqProvider(*ig.OAuthClientSecret, ig.Config)
			_, err := p.Generate(ctx, domain.LLMRequest{
				Messages:  []domain.Message{{Role: domain.RoleUser, Content: "hi"}},
				MaxTokens: 1,
			}, nil)
			return err
		},
	})
}
