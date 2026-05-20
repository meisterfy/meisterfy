package social

import (
	"context"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
)

// Platform maps to the values stored in posts.platforms JSONB.
type Platform string

const (
	PlatformInstagramFeed  Platform = "instagram_feed"
	PlatformInstagramStory Platform = "instagram_story"
	PlatformInstagramReel  Platform = "instagram_reel"
	PlatformFacebook       Platform = "facebook"
	// TODO: add domain.ProviderLinkedIn when LinkedIn support is needed
	// PlatformLinkedIn Platform = "linkedin"
	// TODO: add domain.ProviderX when X support is needed
	// PlatformX Platform = "x"
)

// PlatformProvider maps each platform to its integration provider.
var PlatformProvider = map[Platform]domain.IntegrationProvider{
	PlatformInstagramFeed:  domain.ProviderMeta,
	PlatformInstagramStory: domain.ProviderMeta,
	PlatformInstagramReel:  domain.ProviderMeta,
	PlatformFacebook:       domain.ProviderMeta,
	// PlatformLinkedIn: domain.ProviderLinkedIn, // TODO
	// PlatformX:        domain.ProviderX,        // TODO
}

// PublishResult is returned by Publisher.Publish.
type PublishResult struct {
	ExternalID string
	Platform   Platform
}

// Publisher knows how to publish a post to a specific platform using a ConnectorResource.
type Publisher interface {
	// Publish sends the post to the given platform and returns the external post ID.
	Publish(ctx context.Context, platform Platform, resource *domain.ConnectorResource, post *domain.Post) (PublishResult, error)
	// FetchInsights retrieves available metrics for a published post.
	FetchInsights(ctx context.Context, platform Platform, resource *domain.ConnectorResource, externalID string) (map[string]any, error)
}

// registry holds registered publishers per provider.
var registry = map[domain.IntegrationProvider]Publisher{}

// Register adds a publisher for a provider.
func Register(provider domain.IntegrationProvider, p Publisher) {
	registry[provider] = p
}

// Get returns the publisher for a provider, or nil if not registered.
func Get(provider domain.IntegrationProvider) Publisher {
	return registry[provider]
}
