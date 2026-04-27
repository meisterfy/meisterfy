package monitoring

import (
	"github.com/rush-maestro/rush-maestro/internal/connector"
	"github.com/rush-maestro/rush-maestro/internal/domain"
)

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

const logoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#362D59"/><text x="24" y="33" font-size="13" font-weight="bold" text-anchor="middle" fill="white">Sentry</text></svg>`
