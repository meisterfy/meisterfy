package llm

import (
	"context"
	"fmt"
	"sync"

	"github.com/rush-maestro/rush-maestro/internal/domain"
)

var (
	mu       sync.RWMutex
	registry = map[string]LLMProvider{}
)

// RegisterProvider adds a concrete LLM provider to the global registry.
func RegisterProvider(p LLMProvider) {
	mu.Lock()
	defer mu.Unlock()
	registry[p.Name()] = p
}

// GetProvider retrieves a provider by name.
func GetProvider(name string) (LLMProvider, error) {
	mu.RLock()
	defer mu.RUnlock()
	p, ok := registry[name]
	if !ok {
		return nil, fmt.Errorf("unknown llm provider: %s", name)
	}
	return p, nil
}

// ListProviders returns all registered provider names.
func ListProviders() []string {
	mu.RLock()
	defer mu.RUnlock()
	out := make([]string, 0, len(registry))
	for name := range registry {
		out = append(out, name)
	}
	return out
}

// ProviderSelector resolves which provider and model to use for a tenant/task.
type ProviderSelector struct {
	integrationRepo interface {
		GetForTenant(ctx context.Context, tenantID, provider string) (*domain.Integration, error)
	}
}

// NewProviderSelector creates a selector backed by the integration repository.
func NewProviderSelector(integrationRepo interface {
	GetForTenant(ctx context.Context, tenantID, provider string) (*domain.Integration, error)
}) *ProviderSelector {
	return &ProviderSelector{integrationRepo: integrationRepo}
}

// ProviderCandidate pairs a provider name with its integration record.
type ProviderCandidate struct {
	Name        string
	Integration *domain.Integration
}

// Resolve returns the best provider name and integration for the given tenant.
// It checks integrations in priority order: claude, openai, gemini, groq, kimi.
func (s *ProviderSelector) Resolve(ctx context.Context, tenantID string) (string, *domain.Integration, error) {
	candidates := s.ResolveAll(ctx, tenantID)
	if len(candidates) == 0 {
		return "", nil, fmt.Errorf("no connected llm provider found for tenant %s", tenantID)
	}
	return candidates[0].Name, candidates[0].Integration, nil
}

// ResolveAll returns all connected LLM providers for the tenant in priority order.
func (s *ProviderSelector) ResolveAll(ctx context.Context, tenantID string) []ProviderCandidate {
	order := []string{"claude", "openai", "gemini", "groq", "kimi"}
	var out []ProviderCandidate
	for _, name := range order {
		ig, err := s.integrationRepo.GetForTenant(ctx, tenantID, name)
		if err != nil {
			continue
		}
		if ig.Status != domain.StatusConnected {
			continue
		}
		out = append(out, ProviderCandidate{Name: name, Integration: ig})
	}
	return out
}

// NewProvider instantiates a concrete provider by name with the given API key.
func NewProvider(name, apiKey string) (LLMProvider, error) {
	switch name {
	case "claude":
		return NewAnthropicProvider(apiKey), nil
	case "openai":
		return NewOpenAIProvider(apiKey), nil
	case "gemini":
		return NewGeminiProvider(apiKey), nil
	case "groq":
		return NewGroqProvider(apiKey), nil
	case "kimi":
		return NewKimiProvider(apiKey), nil
	default:
		return nil, fmt.Errorf("unknown provider: %s", name)
	}
}
