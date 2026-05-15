package middleware

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRequestLogger_PassesThrough(t *testing.T) {
	t.Parallel()
	h := RequestLogger(okHandler())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/health", nil))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequestLogger_StatusCaptured(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(slog.Default()) })

	errHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	h := RequestLogger(errHandler)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/boom", nil))

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, buf.String(), "status=500")
}

func TestRequestLogger_LogsMethod(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(slog.Default()) })

	h := RequestLogger(okHandler())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/posts", nil))

	logged := buf.String()
	assert.Contains(t, logged, "method=POST")
	assert.Contains(t, logged, "path=/api/posts")
}
