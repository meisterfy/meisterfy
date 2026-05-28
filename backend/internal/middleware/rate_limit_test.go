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
// using a fresh limiter instead of the package-level loginLimiter. It keys on
// the real peer (trustProxy=false), matching the secure default.
func newTestRateLimit(burst int, window time.Duration) func(http.Handler) http.Handler {
	rl := newRateLimiter(rate.Every(window), burst)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r, false)
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
		r.RemoteAddr = ip + ":12345"
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
	const addr = "10.0.0.3:12345"

	// use the 1 token
	r1 := httptest.NewRequest(http.MethodPost, "/", nil)
	r1.RemoteAddr = addr
	w1 := httptest.NewRecorder()
	h.ServeHTTP(w1, r1)
	assert.Equal(t, http.StatusOK, w1.Code)

	// immediately blocked
	r2 := httptest.NewRequest(http.MethodPost, "/", nil)
	r2.RemoteAddr = addr
	w2 := httptest.NewRecorder()
	h.ServeHTTP(w2, r2)
	assert.Equal(t, http.StatusTooManyRequests, w2.Code)

	// wait for 1 token to refill
	time.Sleep(30 * time.Millisecond)

	r3 := httptest.NewRequest(http.MethodPost, "/", nil)
	r3.RemoteAddr = addr
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
	r.RemoteAddr = "10.1.0.2:12345"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusOK, w.Code, "IP-B should not be affected by IP-A rate limit")
}

// By default spoofable proxy headers are ignored, so an attacker rotating
// X-Forwarded-For cannot escape the per-peer bucket.
func TestRateLimit_IgnoresSpoofedHeadersByDefault(t *testing.T) {
	t.Parallel()
	h := newTestRateLimit(2, time.Second)(okHandler())

	codes := make([]int, 3)
	for i := range codes {
		r := httptest.NewRequest(http.MethodPost, "/", nil)
		r.RemoteAddr = "10.2.0.1:12345"
		r.Header.Set("X-Forwarded-For", "9.9.9."+string(rune('0'+i))) // attacker rotates header
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		codes[i] = w.Code
	}
	assert.Equal(t, http.StatusOK, codes[0])
	assert.Equal(t, http.StatusOK, codes[1])
	assert.Equal(t, http.StatusTooManyRequests, codes[2], "rotating XFF must not bypass the limit")
}

func TestClientIP_UntrustedUsesRemoteAddr(t *testing.T) {
	t.Parallel()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-Real-IP", "203.0.113.1")
	r.Header.Set("X-Forwarded-For", "1.2.3.4")
	r.RemoteAddr = "127.0.0.1:12345"
	assert.Equal(t, "127.0.0.1", clientIP(r, false))
}

func TestClientIP_TrustedUsesXRealIP(t *testing.T) {
	t.Parallel()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-Real-IP", "203.0.113.1")
	r.Header.Set("X-Forwarded-For", "1.2.3.4")
	r.RemoteAddr = "127.0.0.1:12345"
	assert.Equal(t, "203.0.113.1", clientIP(r, true))
}

func TestClientIP_TrustedUsesLeftmostXForwardedFor(t *testing.T) {
	t.Parallel()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-Forwarded-For", "203.0.113.3, 10.0.0.1, 172.16.0.1")
	r.RemoteAddr = "127.0.0.1:12345"
	assert.Equal(t, "203.0.113.3", clientIP(r, true))
}

func TestClientIP_RemoteAddr(t *testing.T) {
	t.Parallel()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "203.0.113.4:54321"
	assert.Equal(t, "203.0.113.4", clientIP(r, false))
}

func TestRateLimitLogin_GlobalMiddleware_Allows(t *testing.T) {
	t.Parallel()
	// one request from a fresh peer always succeeds (global burst is 5)
	h := RateLimitLogin(false)(okHandler())
	r := httptest.NewRequest(http.MethodPost, "/", nil)
	r.RemoteAddr = "198.51.100.1:443" // unique peer, never seen before
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	assert.Equal(t, http.StatusOK, w.Code)
}
