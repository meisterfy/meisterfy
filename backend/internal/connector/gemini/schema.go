package gemini

import (
	"context"
	_ "embed"

	"github.com/meisterfy/meisterfy/internal/connector"
	"github.com/meisterfy/meisterfy/internal/domain"
)

//go:embed logo.svg
var logoSVG string

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderGemini,
		Group:       domain.GroupLLM,
		DisplayName: "Gemini",
		Description: "Generate content using Google's Gemini models.",
		LogoSVG:     logoSVG,
		ConfigFields: []connector.FieldSchema{
			{
				Key: "model", Label: "Analysis Model", Type: connector.FieldTypeSelect, Required: false,
				HelpText: "Model used for deep analysis and AI reports.",
				Options: []connector.SelectOption{
					{Label: "Gemini 2.5 Pro (recommended)", Value: "gemini-2.5-pro"},
					{Label: "Gemini 2.5 Flash", Value: "gemini-2.5-flash"},
					{Label: "Gemini 1.5 Pro", Value: "gemini-1.5-pro"},
					{Label: "Gemini 1.5 Flash", Value: "gemini-1.5-flash"},
				},
			},
			{
				Key: "chat_model", Label: "Chat Model", Type: connector.FieldTypeSelect, Required: false,
				HelpText: "Faster model for real-time chat. Defaults to Analysis Model if not set.",
				Options: []connector.SelectOption{
					{Label: "Same as Analysis Model (default)", Value: ""},
					{Label: "Gemini 1.5 Flash (fastest)", Value: "gemini-1.5-flash"},
					{Label: "Gemini 2.5 Flash", Value: "gemini-2.5-flash"},
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
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true,
				HelpText: "Found at aistudio.google.com → API Keys."},
		},
		TestConnection: func(ctx context.Context, ig *domain.Integration) error {
			if ig.OAuthClientSecret == nil || *ig.OAuthClientSecret == "" {
				return domain.ErrMissingCredentials
			}
			p := NewGeminiProvider(*ig.OAuthClientSecret, ig.Config)
			_, err := p.Generate(ctx, domain.LLMRequest{
				Messages:  []domain.Message{{Role: domain.RoleUser, Content: "hi"}},
				MaxTokens: 1,
			}, nil)
			return err
		},
	})
}
