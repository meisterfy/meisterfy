package googleads

import (
	"context"

	"github.com/rush-maestro/rush-maestro/internal/connector"
	"github.com/rush-maestro/rush-maestro/internal/domain"
)

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

const logoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5l6.7 11.7H17.3z"/><path fill="#FBBC04" d="M41.4 38.5H30.7L17.3 15.5l5.4-3.1z"/><path fill="#34A853" d="M6.6 38.5h11.1l6.7-11.7-5.6-3.1z"/><circle cx="6.6" cy="38.5" r="6" fill="#34A853"/><circle cx="41.4" cy="38.5" r="6" fill="#FBBC04"/><circle cx="24" cy="9.5" r="6" fill="#4285F4"/></svg>`
