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
	h := RequestLogger(slog.Default())(okHandler())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/health", nil))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequestLogger_StatusCaptured(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&buf, nil))

	errHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	h := RequestLogger(logger)(errHandler)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/boom", nil))

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, buf.String(), "status=500")
}

func TestRequestLogger_LogsMethod(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&buf, nil))

	h := RequestLogger(logger)(okHandler())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/posts", nil))

	logged := buf.String()
	assert.Contains(t, logged, "method=POST")
	assert.Contains(t, logged, "path=/api/posts")
}
