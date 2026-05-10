package resend

import (
	_ "embed"

	"github.com/rush-maestro/rush-maestro/internal/connector"
	"github.com/rush-maestro/rush-maestro/internal/domain"
)

//go:embed logo.svg
var logoSVG string

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderSendible,
		Group:       domain.GroupEmail,
		DisplayName: "Resend",
		Description: "Send emails via Resend.",
		LogoSVG:     logoSVG,
		CredentialFields: []connector.FieldSchema{
			{Key: "resend_api_key", Label: "API Key", Type: connector.FieldTypePassword, Required: true},
		},
	})
}
