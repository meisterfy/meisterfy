package storage

import (
	"github.com/rush-maestro/rush-maestro/internal/connector"
	"github.com/rush-maestro/rush-maestro/internal/domain"
)

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderR2,
		Group:       domain.GroupMedia,
		DisplayName: "Cloudflare R2",
		Description: "Store media files in a Cloudflare R2 bucket.",
		LogoSVG:     r2LogoSVG,
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

	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderS3,
		Group:       domain.GroupMedia,
		DisplayName: "Amazon S3",
		Description: "Store media files in an Amazon S3 bucket.",
		LogoSVG:     s3LogoSVG,
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

const r2LogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#F38020"/><text x="24" y="33" font-size="20" font-weight="bold" text-anchor="middle" fill="white">R2</text></svg>`
const s3LogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#E25444"/><text x="24" y="33" font-size="20" font-weight="bold" text-anchor="middle" fill="white">S3</text></svg>`
