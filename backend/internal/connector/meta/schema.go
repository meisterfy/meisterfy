package meta

import (
	"github.com/rush-maestro/rush-maestro/internal/connector"
	"github.com/rush-maestro/rush-maestro/internal/domain"
)

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderMeta,
		Group:       domain.GroupSocialMedia,
		DisplayName: "Meta (Instagram / Facebook)",
		Description: "Publish posts and manage ads on Instagram and Facebook.",
		LogoSVG:     logoSVG,
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_id", Label: "App ID", Type: connector.FieldTypeText, Required: true},
			{Key: "oauth_client_secret", Label: "App Secret", Type: connector.FieldTypePassword, Required: true},
		},
		OAuthFlow:      true,
		OAuthStartPath: "/auth/meta/start",
	})
}

const logoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#1877F2" d="M48 24C48 10.7 37.3 0 24 0S0 10.7 0 24c0 12 8.8 21.9 20.3 23.7V30.9h-6.1V24h6.1v-5.3c0-6 3.6-9.3 9-9.3 2.6 0 5.3.5 5.3.5v5.9h-3c-2.9 0-3.8 1.8-3.8 3.7V24h6.5l-1 6.9h-5.4v16.8C39.2 45.9 48 36 48 24z"/></svg>`
