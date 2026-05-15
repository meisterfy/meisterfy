//go:build smoke

package smoke

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetup_Endpoint_Exists(t *testing.T) {
	resp, err := http.Post(baseURL+"/setup", "application/json", bytes.NewBufferString("{}"))
	require.NoError(t, err, "POST /setup: connection refused — is the server running at %s?", baseURL)
	defer resp.Body.Close()

	// 422 = not yet set up, input validation is running (expected on fresh deploy)
	// 404 = already set up, endpoint is intentionally hidden (expected on live instance)
	// 500 = server crash — never acceptable
	assert.Contains(t,
		[]int{http.StatusUnprocessableEntity, http.StatusNotFound},
		resp.StatusCode,
		"POST /setup: expected 422 (validation running) or 404 (already set up), got %d — a 500 means the server crashed", resp.StatusCode,
	)
}

func TestAuth_Login_Endpoint_Exists(t *testing.T) {
	resp, err := http.Post(baseURL+"/auth/login", "application/json", bytes.NewBufferString("{}"))
	require.NoError(t, err, "POST /auth/login: connection refused — is the server running at %s?", baseURL)
	defer resp.Body.Close()

	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode,
		"POST /auth/login: got 404 — route is not mounted, check router setup")
	assert.NotEqual(t, http.StatusInternalServerError, resp.StatusCode,
		"POST /auth/login: got 500 — server error on empty body")
}

func TestAuth_Login_WrongCredentials_Returns401(t *testing.T) {
	body := bytes.NewBufferString(`{"email":"smoke-probe@example.invalid","password":"wrong-credentials-smoke"}`)
	resp, err := http.Post(baseURL+"/auth/login", "application/json", body)
	require.NoError(t, err, "POST /auth/login: connection refused — is the server running at %s?", baseURL)
	defer resp.Body.Close()

	// 401 proves: route is reachable, DB is connected, auth logic ran to completion
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
		"POST /auth/login with wrong credentials: expected 401 — a 500 means DB is unreachable or auth logic panicked")
}

func TestAdminAPI_RequiresAuth(t *testing.T) {
	endpoints := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/admin/integrations"},
		{http.MethodGet, "/admin/tenants/smoke-probe-id/posts"},
	}

	for _, ep := range endpoints {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			req, err := http.NewRequest(ep.method, baseURL+ep.path, nil)
			require.NoError(t, err)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err, "%s %s: connection refused — is the server running at %s?", ep.method, ep.path, baseURL)
			defer resp.Body.Close()

			assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
				"%s %s: expected 401 (auth middleware active), got %d", ep.method, ep.path, resp.StatusCode)
		})
	}
}

func TestMCP_Endpoint_Exists(t *testing.T) {
	resp, err := http.Post(baseURL+"/mcp", "application/json", bytes.NewBufferString("{}"))
	require.NoError(t, err, "POST /mcp: connection refused — is the server running at %s?", baseURL)
	defer resp.Body.Close()

	// 401 = MCP_API_KEY is configured (expected in production)
	// 200/400/other = no key configured (local dev, MCP server responding)
	// 404 = MCP server is NOT mounted — that's the failure case
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode,
		"POST /mcp: got 404 — MCP server is not mounted, check mcpserver.ServeHTTP registration")
	assert.NotEqual(t, http.StatusInternalServerError, resp.StatusCode,
		"POST /mcp: got 500 — MCP server initialization failed")
}
