package resend

import (
	_ "embed"

	"github.com/meisterfy/meisterfy/internal/connector"
	"github.com/meisterfy/meisterfy/internal/domain"
)

//go:embed logo.svg
var logoSVG string

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderResend,
		Group:       domain.GroupEmail,
		DisplayName: "Resend",
		Description: "Send emails via Resend.",
		LogoSVG:     logoSVG,
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true,
				HelpText: "Found at resend.com → API Keys."},
		},
	})
}
