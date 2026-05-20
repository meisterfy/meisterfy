package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/mcp"
	"github.com/mkt-maestro/mkt-maestro/internal/provider/llm"
)

// RegisterLLMTools registers LLM-related MCP tools.
func RegisterLLMTools(s *mcp.Server, selector *llm.ProviderSelector) {
	s.RegisterTool("generate_content",
		"Generate content using the tenant's configured LLM provider",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"prompt": map[string]any{"type": "string", "description": "The prompt to send to the LLM"},
				"model":  map[string]any{"type": "string", "description": "Optional model override"},
				"system": map[string]any{"type": "string", "description": "Optional system message"},
			},
			"required": []string{"prompt"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			tenantID, ok := mcp.TenantIDFromContext(ctx)
			if !ok {
				return mcp.ErrResult("tenant not authenticated")
			}
			var p struct {
				Prompt string  `json:"prompt"`
				Model  *string `json:"model"`
				System *string `json:"system"`
			}
			if err := json.Unmarshal(args, &p); err != nil {
				return mcp.ErrResult("invalid arguments")
			}
			if p.Prompt == "" {
				return mcp.ErrResult("prompt is required")
			}

			candidates := selector.ResolveAll(ctx, tenantID)
			if len(candidates) == 0 {
				return mcp.ErrResult(fmt.Sprintf("no connected llm provider for tenant %s", tenantID))
			}

			req := domain.LLMRequest{
				TenantID: tenantID,
				Messages: []domain.Message{{Role: domain.RoleUser, Content: p.Prompt}},
				Model:    deref(p.Model),
				System:   deref(p.System),
			}

			var lastErr error
			for _, c := range candidates {
				apiKey := c.Integration.LLMCredentials()
				if apiKey == nil || *apiKey == "" {
					lastErr = fmt.Errorf("provider %s missing credentials", c.Name)
					continue
				}
				inst, err := llm.NewProvider(c.Name, *apiKey, c.Integration.Config)
				if err != nil {
					lastErr = err
					continue
				}
				resp, err := inst.Generate(ctx, req, nil)
				if err != nil {
					lastErr = err
					continue
				}
				return mcp.Ok(map[string]string{"content": resp.Content, "model": resp.Model})
			}
			return mcp.ErrResult(fmt.Sprintf("all llm providers failed: %v", lastErr))
		},
	)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
