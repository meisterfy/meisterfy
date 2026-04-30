package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/rush-maestro/rush-maestro/internal/connector/llm"
	"github.com/rush-maestro/rush-maestro/internal/mcp"
)

// RegisterLLMTools registers LLM-related MCP tools.
func RegisterLLMTools(s *mcp.Server, selector *llm.ProviderSelector) {
	s.RegisterTool("generate_content",
		"Generate content using the tenant's configured LLM provider",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tenant_id": map[string]any{"type": "string", "description": "Tenant ID"},
				"prompt":    map[string]any{"type": "string", "description": "The prompt to send to the LLM"},
				"model":     map[string]any{"type": "string", "description": "Optional model override"},
				"system":    map[string]any{"type": "string", "description": "Optional system message"},
			},
			"required": []string{"tenant_id", "prompt"},
		},
		func(ctx context.Context, args json.RawMessage) mcp.ToolResult {
			var p struct {
				TenantID string  `json:"tenant_id"`
				Prompt   string  `json:"prompt"`
				Model    *string `json:"model"`
				System   *string `json:"system"`
			}
			if err := json.Unmarshal(args, &p); err != nil {
				return mcp.ErrResult("invalid arguments")
			}
			if p.TenantID == "" || p.Prompt == "" {
				return mcp.ErrResult("tenant_id and prompt are required")
			}

			candidates := selector.ResolveAll(ctx, p.TenantID)
			if len(candidates) == 0 {
				return mcp.ErrResult(fmt.Sprintf("no connected llm provider for tenant %s", p.TenantID))
			}

			req := llm.LLMRequest{
				TenantID: p.TenantID,
				Messages: []llm.Message{{Role: llm.RoleUser, Content: p.Prompt}},
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
				inst, err := llm.NewProvider(c.Name, *apiKey)
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
