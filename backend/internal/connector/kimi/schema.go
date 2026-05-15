package kimi

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
		Provider:    domain.ProviderKimi,
		Group:       domain.GroupLLM,
		DisplayName: "Kimi",
		Description: "Generate content using Moonshot's Kimi models.",
		LogoSVG:     logoSVG,
		ConfigFields: []connector.FieldSchema{
			{
				Key: "model", Label: "Analysis Model", Type: connector.FieldTypeSelect, Required: false,
				HelpText: "Model used for deep analysis and AI reports.",
				Options: []connector.SelectOption{
					{Label: "Kimi K2.6 (recommended)", Value: "kimi-k2.6"},
					{Label: "Kimi K1.5", Value: "kimi-k1.5"},
					{Label: "Moonshot v1 32K", Value: "moonshot-v1-32k"},
					{Label: "Moonshot v1 8K", Value: "moonshot-v1-8k"},
				},
			},
			{
				Key: "chat_model", Label: "Chat Model", Type: connector.FieldTypeSelect, Required: false,
				HelpText: "Faster model for real-time chat. Defaults to Analysis Model if not set.",
				Options: []connector.SelectOption{
					{Label: "Same as Analysis Model (default)", Value: ""},
					{Label: "Moonshot v1 8K (fastest)", Value: "moonshot-v1-8k"},
					{Label: "Moonshot v1 32K", Value: "moonshot-v1-32k"},
					{Label: "Kimi K2.6", Value: "kimi-k2.6"},
				},
			},
		},
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true,
				HelpText: "Found at platform.moonshot.cn → API Keys."},
		},
		TestConnection: func(ctx context.Context, ig *domain.Integration) error {
			if ig.OAuthClientSecret == nil || *ig.OAuthClientSecret == "" {
				return domain.ErrMissingCredentials
			}
			p := NewKimiProvider(*ig.OAuthClientSecret, ig.Config)
			_, err := p.Generate(ctx, domain.LLMRequest{
				Messages:  []domain.Message{{Role: domain.RoleUser, Content: "hi"}},
				MaxTokens: 1,
			}, nil)
			return err
		},
	})
}
