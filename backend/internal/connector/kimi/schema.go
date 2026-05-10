package kimi

import (
	_ "embed"

	"github.com/rush-maestro/rush-maestro/internal/connector"
	"github.com/rush-maestro/rush-maestro/internal/domain"
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
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true,
				HelpText: "Found at platform.moonshot.cn → API Keys."},
		},
	})
}
