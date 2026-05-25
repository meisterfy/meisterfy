package anthropic

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
		Provider:    domain.ProviderClaude,
		Group:       domain.GroupLLM,
		DisplayName: "Claude",
		Description: "Generate content using Anthropic's Claude models.",
		LogoSVG:     logoSVG,
		ConfigFields: []connector.FieldSchema{
			{
				Key: "model", Label: "Analysis Model", Type: connector.FieldTypeSelect, Required: false,
				HelpText: "Model used for deep analysis and AI reports.",
				Options: []connector.SelectOption{
					{Label: "Claude Sonnet 4.6 (recommended)", Value: "claude-sonnet-4-6"},
					{Label: "Claude Opus 4.7", Value: "claude-opus-4-7"},
					{Label: "Claude Haiku 4.5", Value: "claude-haiku-4-5-20251001"},
					{Label: "Claude 3.5 Sonnet", Value: "claude-3-5-sonnet-20241022"},
				},
			},
			{
				Key: "chat_model", Label: "Chat Model", Type: connector.FieldTypeSelect, Required: false,
				HelpText: "Faster model for real-time chat. Defaults to Analysis Model if not set.",
				Options: []connector.SelectOption{
					{Label: "Same as Analysis Model (default)", Value: ""},
					{Label: "Claude Haiku 4.5 (fastest)", Value: "claude-haiku-4-5-20251001"},
					{Label: "Claude Sonnet 4.6", Value: "claude-sonnet-4-6"},
					{Label: "Claude 3.5 Sonnet", Value: "claude-3-5-sonnet-20241022"},
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
				HelpText: "Found at console.anthropic.com → API Keys."},
		},
		TestConnection: func(ctx context.Context, ig *domain.Integration) error {
			if ig.OAuthClientSecret == nil || *ig.OAuthClientSecret == "" {
				return domain.ErrMissingCredentials
			}
			p := NewAnthropicProvider(*ig.OAuthClientSecret, ig.Config)
			_, err := p.Generate(ctx, domain.LLMRequest{
				Messages:  []domain.Message{{Role: domain.RoleUser, Content: "hi"}},
				MaxTokens: 1,
			}, nil)
			return err
		},
	})
}
