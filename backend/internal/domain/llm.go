package domain

import "context"

type MessageRole string

const (
	RoleSystem    MessageRole = "system"
	RoleUser      MessageRole = "user"
	RoleAssistant MessageRole = "assistant"
)

type Message struct {
	Role    MessageRole `json:"role"`
	Content string      `json:"content"`
}

type LLMRequest struct {
	TenantID    string    `json:"tenant_id"`
	TaskType    string    `json:"task_type"`
	Model       string    `json:"model,omitempty"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	System      string    `json:"system,omitempty"`
}

type LLMChunk struct {
	Content string `json:"content"`
	Done    bool   `json:"done"`
}

type LLMResponse struct {
	Content string `json:"content"`
	Model   string `json:"model"`
	Usage   Usage  `json:"usage"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type StreamFunc func(chunk LLMChunk) error

type LLMProvider interface {
	Generate(ctx context.Context, req LLMRequest, stream StreamFunc) (*LLMResponse, error)
	Name() string
}

func DefaultTemp(t float64) float64 {
	if t == 0 {
		return 0.7
	}
	return t
}

func DefaultMaxTokens(n int) int {
	if n == 0 {
		return 4096
	}
	return n
}
