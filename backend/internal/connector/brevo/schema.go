package brevo

import (
	_ "embed"

	"github.com/rush-maestro/rush-maestro/internal/connector"
	"github.com/rush-maestro/rush-maestro/internal/domain"
)

//go:embed logo.svg
var logoSVG string

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderBrevo,
		Group:       domain.GroupEmail,
		DisplayName: "Brevo",
		Description: "Send transactional and marketing emails via Brevo (formerly Sendinblue).",
		LogoSVG:     logoSVG,
		ConfigFields: []connector.FieldSchema{
			{Key: "from_email", Label: "From Email", Type: connector.FieldTypeText, Required: true},
		},
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true},
		},
	})
}
