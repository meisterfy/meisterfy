package connector

import (
	"fmt"
	"sync"

	"github.com/rush-maestro/rush-maestro/internal/domain"
)

var (
	mu       sync.RWMutex
	registry = map[domain.IntegrationProvider]*IntegrationSchema{}
)

// RegisterProvider adds a provider schema to the global registry.
// Called from each provider's init() function.
func RegisterProvider(s *IntegrationSchema) {
	mu.Lock()
	defer mu.Unlock()
	registry[s.Provider] = s
}

// GetProvider retrieves a registered provider schema.
func GetProvider(p domain.IntegrationProvider) (*IntegrationSchema, error) {
	mu.RLock()
	defer mu.RUnlock()
	s, ok := registry[p]
	if !ok {
		return nil, fmt.Errorf("unknown provider: %s", p)
	}
	return s, nil
}

// ListProviders returns all registered provider schemas.
func ListProviders() []*IntegrationSchema {
	mu.RLock()
	defer mu.RUnlock()
	out := make([]*IntegrationSchema, 0, len(registry))
	for _, s := range registry {
		out = append(out, s)
	}
	return out
}
