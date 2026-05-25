package s3

import (
	_ "embed"

	"github.com/meisterfy/meisterfy/internal/connector"
	"github.com/meisterfy/meisterfy/internal/domain"
)

//go:embed logo.svg
var logoSVG string

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderS3,
		Group:       domain.GroupMedia,
		DisplayName: "Amazon S3",
		Description: "Store media files in an Amazon S3 bucket.",
		LogoSVG:     logoSVG,
		ConfigFields: []connector.FieldSchema{
			{Key: "bucket", Label: "Bucket Name", Type: connector.FieldTypeText, Required: true},
			{Key: "region", Label: "Region", Type: connector.FieldTypeText, Required: true, Placeholder: "us-east-1"},
		},
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_id", Label: "Access Key ID", Type: connector.FieldTypeText, Required: true},
			{Key: "oauth_client_secret", Label: "Secret Access Key", Type: connector.FieldTypePassword, Required: true},
		},
	})
}
