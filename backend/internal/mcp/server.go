package mcp

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
)

// Server is the MCP server. Register tools and resources before serving.
type Server struct {
	name      string
	version   string
	tools     map[string]*toolDef
	resources map[string]*resourceDef
}

func NewServer(name, version string) *Server {
	return &Server{
		name:      name,
		version:   version,
		tools:     map[string]*toolDef{},
		resources: map[string]*resourceDef{},
	}
}

// --- Tool registration -------------------------------------------------------

type toolDef struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
	handler     func(ctx context.Context, args json.RawMessage) ToolResult
}

// ToolResult is the result of a tool call.
type ToolResult struct {
	Content []ContentItem `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

// ContentItem is a single content item in a tool result.
type ContentItem struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// Ok wraps a value as a JSON text content result.
func Ok(v any) ToolResult {
	b, _ := json.MarshalIndent(v, "", "  ")
	return ToolResult{Content: []ContentItem{{Type: "text", Text: string(b)}}}
}

// ErrResult wraps an error string as an isError tool result.
func ErrResult(msg string) ToolResult {
	return ToolResult{Content: []ContentItem{{Type: "text", Text: msg}}, IsError: true}
}

func (s *Server) RegisterTool(name, description string, schema map[string]any,
	handler func(ctx context.Context, args json.RawMessage) ToolResult) {
	s.tools[name] = &toolDef{
		Name:        name,
		Description: description,
		InputSchema: schema,
		handler:     handler,
	}
}

// --- Resource registration ---------------------------------------------------

type resourceDef struct {
	Name     string `json:"name"`
	URI      string `json:"uri,omitempty"`
	Template string `json:"uriTemplate,omitempty"`
	MimeType string `json:"mimeType"`
	handler  func(ctx context.Context, uri string, vars map[string]string) (string, error)
}

func (s *Server) RegisterResource(name, uri, mimeType string,
	handler func(ctx context.Context, uri string, vars map[string]string) (string, error)) {
	s.resources[uri] = &resourceDef{
		Name:     name,
		URI:      uri,
		MimeType: mimeType,
		handler:  handler,
	}
}

func (s *Server) RegisterResourceTemplate(name, uriTemplate, mimeType string,
	handler func(ctx context.Context, uri string, vars map[string]string) (string, error)) {
	s.resources[uriTemplate] = &resourceDef{
		Name:     name,
		Template: uriTemplate,
		MimeType: mimeType,
		handler:  handler,
	}
}

// --- HTTP handler ------------------------------------------------------------

type jsonRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type jsonRPCResponse struct {
	JSONRPC string    `json:"jsonrpc"`
	ID      any       `json:"id,omitempty"`
	Result  any       `json:"result,omitempty"`
	Error   *rpcError `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		http.Error(w, "Use POST for MCP requests", http.StatusMethodNotAllowed)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req jsonRPCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeRPCError(w, nil, -32700, "Parse error")
		return
	}

	// Notifications have no id — acknowledge and return empty 200
	if req.ID == nil && req.Method != "" {
		w.WriteHeader(http.StatusOK)
		return
	}

	result, rpcErr := s.dispatch(r.Context(), &req)
	if rpcErr != nil {
		writeRPCError(w, req.ID, rpcErr.Code, rpcErr.Message)
		return
	}

	resp := jsonRPCResponse{JSONRPC: "2.0", ID: req.ID, Result: result}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

func (s *Server) dispatch(ctx context.Context, req *jsonRPCRequest) (any, *rpcError) {
	switch req.Method {
	case "initialize":
		return s.handleInitialize(req.Params)
	case "tools/list":
		return s.handleToolsList()
	case "tools/call":
		return s.handleToolsCall(ctx, req.Params)
	case "resources/list":
		return s.handleResourcesList()
	case "resources/read":
		return s.handleResourcesRead(ctx, req.Params)
	default:
		return nil, &rpcError{Code: -32601, Message: "Method not found: " + req.Method}
	}
}

func (s *Server) handleInitialize(_ json.RawMessage) (any, *rpcError) {
	return map[string]any{
		"protocolVersion": "2024-11-05",
		"capabilities":    map[string]any{"tools": map[string]any{}, "resources": map[string]any{}},
		"serverInfo":      map[string]any{"name": s.name, "version": s.version},
	}, nil
}

func (s *Server) handleToolsList() (any, *rpcError) {
	list := make([]map[string]any, 0, len(s.tools))
	for _, t := range s.tools {
		entry := map[string]any{
			"name":        t.Name,
			"description": t.Description,
		}
		if t.InputSchema != nil {
			entry["inputSchema"] = t.InputSchema
		} else {
			entry["inputSchema"] = map[string]any{"type": "object", "properties": map[string]any{}}
		}
		list = append(list, entry)
	}
	return map[string]any{"tools": list}, nil
}

func (s *Server) handleToolsCall(ctx context.Context, params json.RawMessage) (any, *rpcError) {
	var p struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, &rpcError{Code: -32602, Message: "Invalid params"}
	}
	t, found := s.tools[p.Name]
	if !found {
		return nil, &rpcError{Code: -32602, Message: "Unknown tool: " + p.Name}
	}
	if p.Arguments == nil {
		p.Arguments = json.RawMessage("{}")
	}
	result := t.handler(ctx, p.Arguments)
	return result, nil
}

func (s *Server) handleResourcesList() (any, *rpcError) {
	list := make([]map[string]any, 0, len(s.resources))
	for _, res := range s.resources {
		entry := map[string]any{"name": res.Name, "mimeType": res.MimeType}
		if res.Template != "" {
			entry["uriTemplate"] = res.Template
		} else {
			entry["uri"] = res.URI
		}
		list = append(list, entry)
	}
	return map[string]any{"resources": list}, nil
}

func (s *Server) handleResourcesRead(ctx context.Context, params json.RawMessage) (any, *rpcError) {
	var p struct {
		URI string `json:"uri"`
	}
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, &rpcError{Code: -32602, Message: "Invalid params"}
	}

	res := s.resolveResource(p.URI)
	if res == nil {
		return nil, &rpcError{Code: -32602, Message: "Resource not found: " + p.URI}
	}

	vars := extractTemplateVars(res.Template, p.URI)
	text, err := res.handler(ctx, p.URI, vars)
	if err != nil {
		return nil, &rpcError{Code: -32603, Message: err.Error()}
	}

	return map[string]any{
		"contents": []map[string]any{
			{"uri": p.URI, "mimeType": res.MimeType, "text": text},
		},
	}, nil
}

func (s *Server) resolveResource(uri string) *resourceDef {
	if r, ok := s.resources[uri]; ok {
		return r
	}
	for _, r := range s.resources {
		if r.Template != "" && matchTemplate(r.Template, uri) {
			return r
		}
	}
	return nil
}

func matchTemplate(template, uri string) bool {
	_, ok := extractVars(template, uri)
	return ok
}

func extractTemplateVars(template, uri string) map[string]string {
	if template == "" {
		return nil
	}
	vars, _ := extractVars(template, uri)
	return vars
}

func extractVars(template, uri string) (map[string]string, bool) {
	vars := map[string]string{}
	ti, ui := 0, 0
	for ti < len(template) && ui < len(uri) {
		if template[ti] == '{' {
			end := strings.Index(template[ti:], "}")
			if end < 0 {
				return nil, false
			}
			key := template[ti+1 : ti+end]
			ti += end + 1
			var delim byte
			if ti < len(template) {
				delim = template[ti]
			}
			start := ui
			for ui < len(uri) && (delim == 0 || uri[ui] != delim) {
				ui++
			}
			vars[key] = uri[start:ui]
		} else {
			if template[ti] != uri[ui] {
				return nil, false
			}
			ti++
			ui++
		}
	}
	return vars, ti == len(template) && ui == len(uri)
}

func writeRPCError(w http.ResponseWriter, id any, code int, message string) {
	resp := jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &rpcError{Code: code, Message: message},
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}
