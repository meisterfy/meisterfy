package googleads

import (
	"context"
	_ "embed"

	"github.com/meisterfy/meisterfy/internal/connector"
	"github.com/meisterfy/meisterfy/internal/domain"
)

//go:embed logo.svg
var logoSVG string

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderGoogleAds,
		Group:       domain.GroupAds,
		DisplayName: "Google Ads",
		Description: "Manage campaigns, budgets, and keywords via the Google Ads API.",
		LogoSVG:     logoSVG,
		ConfigFields: []connector.FieldSchema{
			{
				Key:      "developer_token",
				Label:    "Developer Token",
				Type:     connector.FieldTypePassword,
				Required: true,
				HelpText: "Found in Google Ads → Tools → API Center.",
			},
			{
				Key:      "login_customer_id",
				Label:    "MCC Customer ID",
				Type:     connector.FieldTypeText,
				HelpText: "Your manager account ID (123-456-7890). Leave blank if using a direct account.",
			},
		},
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_id", Label: "OAuth Client ID", Type: connector.FieldTypeText, Required: true},
			{Key: "oauth_client_secret", Label: "OAuth Client Secret", Type: connector.FieldTypePassword, Required: true},
		},
		OAuthFlow:      true,
		OAuthStartPath: "/auth/google-ads/start",
		TestConnection: testConnection,
	})
}

func testConnection(_ context.Context, _ *domain.Integration) error {
	// Implemented in T17 when the Google Ads connector is built.
	return nil
}
