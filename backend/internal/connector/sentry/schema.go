package sentry

import (
	_ "embed"

	"github.com/mkt-maestro/mkt-maestro/internal/connector"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
)

//go:embed logo.svg
var logoSVG string

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderSentry,
		Group:       domain.GroupMonitoring,
		DisplayName: "Sentry",
		Description: "Track errors and performance issues in production.",
		LogoSVG:     logoSVG,
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "DSN", Type: connector.FieldTypeURL, Required: true,
				HelpText: "Found in Sentry → Project Settings → Client Keys (DSN)."},
		},
	})
}
