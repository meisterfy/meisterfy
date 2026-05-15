package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAdminCORS_AllowedOrigin_OPTIONS(t *testing.T) {
	t.Parallel()
	h := AdminCORS("https://app.example.com,https://admin.example.com")(okHandler())
	r := httptest.NewRequest(http.MethodOptions, "/", nil)
	r.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, "https://app.example.com", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", w.Header().Get("Access-Control-Allow-Credentials"))
	assert.NotEmpty(t, w.Header().Get("Access-Control-Allow-Methods"))
	assert.NotEmpty(t, w.Header().Get("Access-Control-Allow-Headers"))
}

func TestAdminCORS_AllowedOrigin_GET(t *testing.T) {
	t.Parallel()
	h := AdminCORS("https://app.example.com")(okHandler())
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "https://app.example.com", w.Header().Get("Access-Control-Allow-Origin"))
}

func TestAdminCORS_UnknownOrigin_OPTIONS(t *testing.T) {
	t.Parallel()
	h := AdminCORS("https://app.example.com")(okHandler())
	r := httptest.NewRequest(http.MethodOptions, "/", nil)
	r.Header.Set("Origin", "https://evil.example.com")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestAdminCORS_UnknownOrigin_GET(t *testing.T) {
	t.Parallel()
	h := AdminCORS("https://app.example.com")(okHandler())
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Origin", "https://evil.example.com")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestAdminCORS_MultipleAllowedOrigins(t *testing.T) {
	t.Parallel()
	h := AdminCORS("https://app.example.com, https://admin.example.com")(okHandler())

	for _, origin := range []string{"https://app.example.com", "https://admin.example.com"} {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		assert.Equal(t, origin, w.Header().Get("Access-Control-Allow-Origin"), "origin %s should be allowed", origin)
	}
}
