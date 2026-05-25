package r2

import (
	_ "embed"

	"github.com/meisterfy/meisterfy/internal/connector"
	"github.com/meisterfy/meisterfy/internal/domain"
)

//go:embed logo.svg
var logoSVG string

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderR2,
		Group:       domain.GroupMedia,
		DisplayName: "Cloudflare R2",
		Description: "Store media files in a Cloudflare R2 bucket.",
		LogoSVG:     logoSVG,
		ConfigFields: []connector.FieldSchema{
			{Key: "bucket", Label: "Bucket Name", Type: connector.FieldTypeText, Required: true},
			{Key: "endpoint", Label: "Endpoint URL", Type: connector.FieldTypeURL, Required: true,
				HelpText: "https://<account-id>.r2.cloudflarestorage.com"},
		},
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_id", Label: "Access Key ID", Type: connector.FieldTypeText, Required: true},
			{Key: "oauth_client_secret", Label: "Secret Access Key", Type: connector.FieldTypePassword, Required: true},
		},
	})
}
