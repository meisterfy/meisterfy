package email

import (
	"github.com/rush-maestro/rush-maestro/internal/connector"
	"github.com/rush-maestro/rush-maestro/internal/domain"
)

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderBrevo,
		Group:       domain.GroupEmail,
		DisplayName: "Brevo",
		Description: "Send transactional and marketing emails via Brevo (formerly Sendinblue).",
		LogoSVG:     brevoLogoSVG,
		ConfigFields: []connector.FieldSchema{
			{Key: "from_email", Label: "From Email", Type: connector.FieldTypeText, Required: true},
		},
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true},
		},
	})

	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderSendible,
		Group:       domain.GroupEmail,
		DisplayName: "Sendible",
		Description: "Schedule and publish social media posts via Sendible.",
		LogoSVG:     sendibleLogoSVG,
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true},
		},
	})
}

const brevoLogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#0B996E"/><text x="24" y="33" font-size="14" font-weight="bold" text-anchor="middle" fill="white">Brevo</text></svg>`
const sendibleLogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#3AACDE"/><text x="24" y="33" font-size="11" font-weight="bold" text-anchor="middle" fill="white">Sendible</text></svg>`
