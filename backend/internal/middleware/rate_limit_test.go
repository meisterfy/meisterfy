package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"golang.org/x/time/rate"
)

// newTestRateLimit creates an isolated rate-limit middleware for testing,
// using a fresh limiter instead of the package-level loginLimiter.
func newTestRateLimit(burst int, window time.Duration) func(http.Handler) http.Handler {
	rl := newRateLimiter(rate.Every(window), burst)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := realIP(r)
			if !rl.get(ip).Allow() {
				http.Error(w, `{"error":"too many requests"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func sendN(h http.Handler, n int, ip string) []int {
	codes := make([]int, n)
	for i := range n {
		r := httptest.NewRequest(http.MethodPost, "/", nil)
		r.Header.Set("X-Real-IP", ip)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		codes[i] = w.Code
	}
	return codes
}

func TestRateLimitLogin_AllowsUnderLimit(t *testing.T) {
	t.Parallel()
	h := newTestRateLimit(3, time.Second)(okHandler())
	codes := sendN(h, 2, "10.0.0.1")
	for _, c := range codes {
		assert.Equal(t, http.StatusOK, c)
	}
}

func TestRateLimitLogin_BlocksAtLimit(t *testing.T) {
	t.Parallel()
	h := newTestRateLimit(3, time.Second)(okHandler())
	codes := sendN(h, 4, "10.0.0.2")
	for i, c := range codes[:3] {
		assert.Equal(t, http.StatusOK, c, "request %d should be allowed", i+1)
	}
	assert.Equal(t, http.StatusTooManyRequests, codes[3])
}

func TestRateLimitLogin_ResetsAfterWindow(t *testing.T) {
	t.Parallel()
	h := newTestRateLimit(1, 20*time.Millisecond)(okHandler())
	ip := "10.0.0.3"

	// use the 1 token
	r1 := httptest.NewRequest(http.MethodPost, "/", nil)
	r1.Header.Set("X-Real-IP", ip)
	w1 := httptest.NewRecorder()
	h.ServeHTTP(w1, r1)
	assert.Equal(t, http.StatusOK, w1.Code)

	// immediately blocked
	r2 := httptest.NewRequest(http.MethodPost, "/", nil)
	r2.Header.Set("X-Real-IP", ip)
	w2 := httptest.NewRecorder()
	h.ServeHTTP(w2, r2)
	assert.Equal(t, http.StatusTooManyRequests, w2.Code)

	// wait for 1 token to refill
	time.Sleep(30 * time.Millisecond)

	r3 := httptest.NewRequest(http.MethodPost, "/", nil)
	r3.Header.Set("X-Real-IP", ip)
	w3 := httptest.NewRecorder()
	h.ServeHTTP(w3, r3)
	assert.Equal(t, http.StatusOK, w3.Code)
}

func TestRateLimitLogin_IsolatesByIP(t *testing.T) {
	t.Parallel()
	h := newTestRateLimit(2, time.Second)(okHandler())

	// exhaust IP-A
	codesA := sendN(h, 3, "10.1.0.1")
	assert.Equal(t, http.StatusTooManyRequests, codesA[2], "IP-A should be blocked")

	// IP-B should still be allowed
	r := httptest.NewRequest(http.MethodPost, "/", nil)
	r.Header.Set("X-Real-IP", "10.1.0.2")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusOK, w.Code, "IP-B should not be affected by IP-A rate limit")
}

func TestRealIP_XRealIP(t *testing.T) {
	t.Parallel()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-Real-IP", "203.0.113.1")
	r.Header.Set("X-Forwarded-For", "1.2.3.4")
	r.RemoteAddr = "127.0.0.1:12345"
	assert.Equal(t, "203.0.113.1", realIP(r))
}

func TestRealIP_XForwardedFor(t *testing.T) {
	t.Parallel()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-Forwarded-For", "203.0.113.2")
	r.RemoteAddr = "127.0.0.1:12345"
	assert.Equal(t, "203.0.113.2", realIP(r))
}

func TestRealIP_XForwardedFor_MultipleIPs(t *testing.T) {
	t.Parallel()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-Forwarded-For", "203.0.113.3, 10.0.0.1, 172.16.0.1")
	r.RemoteAddr = "127.0.0.1:12345"
	assert.Equal(t, "203.0.113.3", realIP(r))
}

func TestRealIP_RemoteAddr(t *testing.T) {
	t.Parallel()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "203.0.113.4:54321"
	assert.Equal(t, "203.0.113.4", realIP(r))
}

func TestRateLimitLogin_GlobalMiddleware_Allows(t *testing.T) {
	t.Parallel()
	// one request from a fresh IP always succeeds (global burst is 5)
	h := RateLimitLogin(okHandler())
	r := httptest.NewRequest(http.MethodPost, "/", nil)
	r.Header.Set("X-Real-IP", "198.51.100.1") // unique IP, never seen before
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusOK, w.Code)
}
