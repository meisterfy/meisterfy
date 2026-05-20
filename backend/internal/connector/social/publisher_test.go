package social

import (
	"context"
	"testing"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
)

type noopPublisher struct{ id int }

func (p *noopPublisher) Publish(_ context.Context, _ Platform, _ *domain.ConnectorResource, _ *domain.Post) (PublishResult, error) {
	return PublishResult{}, nil
}

func (p *noopPublisher) FetchInsights(_ context.Context, _ Platform, _ *domain.ConnectorResource, _ string) (map[string]any, error) {
	return nil, nil
}

func TestPlatformProvider_AllMetaPlatforms(t *testing.T) {
	t.Parallel()
	platforms := []Platform{PlatformInstagramFeed, PlatformInstagramStory, PlatformInstagramReel, PlatformFacebook}
	for _, p := range platforms {
		t.Run(string(p), func(t *testing.T) {
			t.Parallel()
			got, ok := PlatformProvider[p]
			if !ok {
				t.Fatalf("platform %q missing from PlatformProvider", p)
			}
			if got != domain.ProviderMeta {
				t.Errorf("PlatformProvider[%q] = %q, want %q", p, got, domain.ProviderMeta)
			}
		})
	}
}

func TestRegistry_RegisterAndGet(t *testing.T) { //nolint:paralleltest // modifies global registry
	orig := registry
	t.Cleanup(func() { registry = orig })
	registry = map[domain.IntegrationProvider]Publisher{}

	if got := Get(domain.ProviderMeta); got != nil {
		t.Fatal("expected nil before registration")
	}

	pub := &noopPublisher{id: 1}
	Register(domain.ProviderMeta, pub)

	got := Get(domain.ProviderMeta)
	if got == nil {
		t.Fatal("expected non-nil publisher after registration")
	}
	if got != pub {
		t.Error("Get returned a different publisher than registered")
	}
}

func TestRegistry_Get_NotRegistered(t *testing.T) {
	t.Parallel()
	unknown := domain.IntegrationProvider("provider_definitely_not_registered_xyz")
	if got := Get(unknown); got != nil {
		t.Errorf("Get(%q) = non-nil, want nil", unknown)
	}
}

func TestRegistry_Register_Overwrites(t *testing.T) { //nolint:paralleltest // modifies global registry
	orig := registry
	t.Cleanup(func() { registry = orig })
	registry = map[domain.IntegrationProvider]Publisher{}

	first := &noopPublisher{id: 1}
	Register(domain.ProviderMeta, first)
	second := &noopPublisher{id: 2}
	Register(domain.ProviderMeta, second)

	got := Get(domain.ProviderMeta)
	if got != second {
		t.Error("expected second registration to overwrite first")
	}
	if len(registry) != 1 {
		t.Errorf("registry len = %d, want 1 (no duplicates)", len(registry))
	}
}
