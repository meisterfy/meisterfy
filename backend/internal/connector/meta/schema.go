package meta

import (
	"context"
	_ "embed"

	"github.com/mkt-maestro/mkt-maestro/internal/connector"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
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
		OAuthFlow:      true,
		OAuthStartPath: "/auth/meta/start",
		DiscoverResources: func(ctx context.Context, ig *domain.Integration, store connector.ResourceStore) error {
			if ig.RefreshToken == nil {
				return nil
			}
			client := NewClient(*ig.RefreshToken)
			pages, err := client.GetAccounts(ctx)
			if err != nil {
				return err
			}
			for _, tenantID := range ig.TenantIDs {
				_ = store.DeleteByTenantProvider(ctx, tenantID, domain.ProviderMeta)
				for _, page := range pages {
					igAccount, _ := client.GetIGAccount(ctx, page.ID, page.AccessToken)
					name := page.Name
					res := &domain.ConnectorResource{
						ID:            domain.NewID(),
						TenantID:      tenantID,
						IntegrationID: ig.ID,
						Provider:      domain.ProviderMeta,
						ResourceType:  "page",
						ResourceID:    page.ID,
						ResourceName:  &name,
						Metadata:      map[string]any{},
					}
					if igAccount != nil {
						res.Metadata["ig_user_id"] = igAccount.ID
						res.Metadata["ig_username"] = igAccount.Username
					}
					_ = store.Upsert(ctx, res)
				}
			}
			return nil
		},
	})
}
