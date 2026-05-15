//go:build smoke

package smoke

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealth_ReturnsOK(t *testing.T) {
	resp, err := http.Get(baseURL + "/health")
	require.NoError(t, err, "GET /health: connection refused — is the server running at %s?", baseURL)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "GET /health: expected 200 OK")

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body), "GET /health: response is not valid JSON")
	assert.Equal(t, "ok", body["status"], `GET /health: body["status"] must be "ok"`)
	_, hasSetupRequired := body["setup_required"]
	assert.True(t, hasSetupRequired, `GET /health: body must include "setup_required" field`)
}

func TestHealth_ResponseTime(t *testing.T) {
	start := time.Now()
	resp, err := http.Get(baseURL + "/health")
	elapsed := time.Since(start)

	require.NoError(t, err, "GET /health: connection refused — is the server running at %s?", baseURL)
	resp.Body.Close()

	assert.Less(t, elapsed, 500*time.Millisecond,
		"GET /health took %s — must respond in < 500ms", elapsed)
}
