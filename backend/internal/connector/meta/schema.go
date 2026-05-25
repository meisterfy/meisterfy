package meta

import (
	_ "embed"

	"github.com/meisterfy/meisterfy/internal/connector"
	"github.com/meisterfy/meisterfy/internal/domain"
)

//go:embed logo.svg
var logoSVG string

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderMeta,
		Group:       domain.GroupSocialMedia,
		DisplayName: "Meta",
		Description: "Publish posts and manage ads on Instagram and Facebook.",
		LogoSVG:     logoSVG,
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_id", Label: "App ID", Type: connector.FieldTypeText, Required: true},
			{Key: "oauth_client_secret", Label: "App Secret", Type: connector.FieldTypePassword, Required: true},
		},
		OAuthFlow:         true,
		OAuthStartPath:    "/auth/meta/start",
		DiscoverResources: nil,
	})
}
