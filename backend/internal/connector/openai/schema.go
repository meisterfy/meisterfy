package openai

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
		Provider:    domain.ProviderOpenAI,
		Group:       domain.GroupLLM,
		DisplayName: "ChatGPT",
		Description: "Generate content using OpenAI's GPT models.",
		LogoSVG:     logoSVG,
		ConfigFields: []connector.FieldSchema{
			{
				Key: "model", Label: "Analysis Model", Type: connector.FieldTypeSelect, Required: false,
				HelpText: "Model used for deep analysis and AI reports.",
				Options: []connector.SelectOption{
					{Label: "GPT-4o mini (recommended)", Value: "gpt-4o-mini"},
					{Label: "GPT-4o", Value: "gpt-4o"},
					{Label: "o4-mini", Value: "o4-mini"},
					{Label: "o3", Value: "o3"},
				},
			},
			{
				Key: "chat_model", Label: "Chat Model", Type: connector.FieldTypeSelect, Required: false,
				HelpText: "Faster model for real-time chat. Defaults to Analysis Model if not set.",
				Options: []connector.SelectOption{
					{Label: "Same as Analysis Model (default)", Value: ""},
					{Label: "GPT-4o mini (fastest)", Value: "gpt-4o-mini"},
					{Label: "GPT-4o", Value: "gpt-4o"},
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
			p := NewOpenAIProvider(*ig.OAuthClientSecret, ig.Config)
			_, err := p.Generate(ctx, domain.LLMRequest{
				Messages:  []domain.Message{{Role: domain.RoleUser, Content: "hi"}},
				MaxTokens: 1,
			}, nil)
			return err
		},
	})
}
