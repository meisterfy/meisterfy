package llm

import (
	"context"
	"errors"
	"testing"

	"github.com/rush-maestro/rush-maestro/internal/domain"
)

type mockIntegrationRepo struct {
	integrations map[string]*domain.Integration
}

func (m *mockIntegrationRepo) GetForTenant(ctx context.Context, tenantID, provider string) (*domain.Integration, error) {
	key := tenantID + "/" + provider
	ig, ok := m.integrations[key]
	if !ok {
		return nil, errors.New("not found")
	}
	return ig, nil
}

func TestProviderSelector_Resolve_Priority(t *testing.T) {
	repo := &mockIntegrationRepo{integrations: map[string]*domain.Integration{
		"t1/openai": {
			Provider: domain.ProviderOpenAI,
			Status:   domain.StatusConnected,
			OAuthClientSecret: strPtr("sk-openai"),
		},
		"t1/groq": {
			Provider: domain.ProviderGroq,
			Status:   domain.StatusConnected,
			OAuthClientSecret: strPtr("sk-groq"),
		},
	}}

	selector := NewProviderSelector(repo)
	name, ig, err := selector.Resolve(context.Background(), "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if name != "openai" {
		t.Fatalf("expected openai (first connected in priority order), got %s", name)
	}
	if ig.Provider != domain.ProviderOpenAI {
		t.Fatalf("expected openai integration, got %s", ig.Provider)
	}
}

func TestProviderSelector_Resolve_Fallback(t *testing.T) {
	repo := &mockIntegrationRepo{integrations: map[string]*domain.Integration{
		"t2/claude": {
			Provider: domain.ProviderClaude,
			Status:   domain.StatusError,
			OAuthClientSecret: strPtr("sk-claude"),
		},
		"t2/groq": {
			Provider: domain.ProviderGroq,
			Status:   domain.StatusConnected,
			OAuthClientSecret: strPtr("sk-groq"),
		},
	}}

	selector := NewProviderSelector(repo)
	name, ig, err := selector.Resolve(context.Background(), "t2")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if name != "groq" {
		t.Fatalf("expected groq fallback, got %s", name)
	}
	if ig.Provider != domain.ProviderGroq {
		t.Fatalf("expected groq integration, got %s", ig.Provider)
	}
}

func TestProviderSelector_Resolve_NoProvider(t *testing.T) {
	repo := &mockIntegrationRepo{integrations: map[string]*domain.Integration{}}
	selector := NewProviderSelector(repo)
	_, _, err := selector.Resolve(context.Background(), "t3")
	if err == nil {
		t.Fatal("expected error when no provider available")
	}
}

func TestProviderSelector_ResolveAll_Order(t *testing.T) {
	repo := &mockIntegrationRepo{integrations: map[string]*domain.Integration{
		"t4/groq": {
			Provider:          domain.ProviderGroq,
			Status:            domain.StatusConnected,
			OAuthClientSecret: strPtr("sk-groq"),
		},
		"t4/openai": {
			Provider:          domain.ProviderOpenAI,
			Status:            domain.StatusConnected,
			OAuthClientSecret: strPtr("sk-openai"),
		},
		"t4/claude": {
			Provider:          domain.ProviderClaude,
			Status:            domain.StatusError,
			OAuthClientSecret: strPtr("sk-claude"),
		},
	}}
	selector := NewProviderSelector(repo)
	candidates := selector.ResolveAll(context.Background(), "t4")
	if len(candidates) != 2 {
		t.Fatalf("expected 2 connected providers, got %d", len(candidates))
	}
	if candidates[0].Name != "openai" {
		t.Fatalf("expected openai first in priority order, got %s", candidates[0].Name)
	}
	if candidates[1].Name != "groq" {
		t.Fatalf("expected groq second, got %s", candidates[1].Name)
	}
}

func TestProviderSelector_ResolveAll_Empty(t *testing.T) {
	repo := &mockIntegrationRepo{integrations: map[string]*domain.Integration{}}
	selector := NewProviderSelector(repo)
	candidates := selector.ResolveAll(context.Background(), "t5")
	if len(candidates) != 0 {
		t.Fatalf("expected 0 providers, got %d", len(candidates))
	}
}

func TestGetProvider_Registered(t *testing.T) {
	// Ensure built-in providers are registered via init in schema.go (indirectly).
	// Since schema.go registers UI schemas, the LLM provider registry is separate.
	// Register a test provider.
	RegisterProvider(&testProvider{name: "test-provider"})
	p, err := GetProvider("test-provider")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if p.Name() != "test-provider" {
		t.Fatalf("expected test-provider, got %s", p.Name())
	}
}

func TestGetProvider_Unknown(t *testing.T) {
	_, err := GetProvider("nonexistent")
	if err == nil {
		t.Fatal("expected error for unknown provider")
	}
}

type testProvider struct {
	name string
}

func (t *testProvider) Name() string { return t.name }
func (t *testProvider) Generate(ctx context.Context, req LLMRequest, stream StreamFunc) (*LLMResponse, error) {
	return nil, nil
}

func strPtr(s string) *string { return &s }
