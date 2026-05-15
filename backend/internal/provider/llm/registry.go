package llm

import (
	"context"
	"fmt"
	"sync"

	"github.com/mkt-maestro/mkt-maestro/internal/connector/anthropic"
	"github.com/mkt-maestro/mkt-maestro/internal/connector/gemini"
	"github.com/mkt-maestro/mkt-maestro/internal/connector/groq"
	"github.com/mkt-maestro/mkt-maestro/internal/connector/kimi"
	"github.com/mkt-maestro/mkt-maestro/internal/connector/openai"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
)

var (
	mu       sync.RWMutex
	registry = map[string]domain.LLMProvider{}
)

func RegisterProvider(p domain.LLMProvider) {
	mu.Lock()
	defer mu.Unlock()
	registry[p.Name()] = p
}

func GetProvider(name string) (domain.LLMProvider, error) {
	mu.RLock()
	defer mu.RUnlock()
	p, ok := registry[name]
	if !ok {
		return nil, fmt.Errorf("unknown llm provider: %s", name)
	}
	return p, nil
}

func ListProviders() []string {
	mu.RLock()
	defer mu.RUnlock()
	out := make([]string, 0, len(registry))
	for name := range registry {
		out = append(out, name)
	}
	return out
}

type ProviderSelector struct {
	integrationRepo interface {
		GetForTenant(ctx context.Context, tenantID, provider string) (*domain.Integration, error)
	}
}

func NewProviderSelector(integrationRepo interface {
	GetForTenant(ctx context.Context, tenantID, provider string) (*domain.Integration, error)
}) *ProviderSelector {
	return &ProviderSelector{integrationRepo: integrationRepo}
}

type ProviderCandidate struct {
	Name        string
	Integration *domain.Integration
}

func (s *ProviderSelector) Resolve(ctx context.Context, tenantID string) (string, *domain.Integration, error) {
	candidates := s.ResolveAll(ctx, tenantID)
	if len(candidates) == 0 {
		return "", nil, fmt.Errorf("no connected llm provider found for tenant %s", tenantID)
	}
	return candidates[0].Name, candidates[0].Integration, nil
}

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

func NewProvider(name, apiKey string, cfg map[string]any) (domain.LLMProvider, error) {
	switch name {
	case "claude":
		return anthropic.NewAnthropicProvider(apiKey, cfg), nil
	case "openai":
		return openai.NewOpenAIProvider(apiKey, cfg), nil
	case "gemini":
		return gemini.NewGeminiProvider(apiKey, cfg), nil
	case "groq":
		return groq.NewGroqProvider(apiKey, cfg), nil
	case "kimi":
		return kimi.NewKimiProvider(apiKey, cfg), nil
	default:
		return nil, fmt.Errorf("unknown provider: %s", name)
	}
}
