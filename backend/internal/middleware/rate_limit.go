package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type rateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*ipLimiter
	r        rate.Limit
	b        int
}

func newRateLimiter(r rate.Limit, b int) *rateLimiter {
	rl := &rateLimiter{
		limiters: make(map[string]*ipLimiter),
		r:        r,
		b:        b,
	}
	go rl.cleanup()
	return rl
}

func (rl *rateLimiter) get(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	l, ok := rl.limiters[ip]
	if !ok {
		l = &ipLimiter{limiter: rate.NewLimiter(rl.r, rl.b)}
		rl.limiters[ip] = l
	}
	l.lastSeen = time.Now()
	return l.limiter
}

func (rl *rateLimiter) cleanup() {
	for range time.Tick(5 * time.Minute) {
		rl.mu.Lock()
		for ip, l := range rl.limiters {
			if time.Since(l.lastSeen) > 10*time.Minute {
				delete(rl.limiters, ip)
			}
		}
		rl.mu.Unlock()
	}
}

var loginLimiter = newRateLimiter(rate.Every(10*time.Second), 5) // 5 attempts per 10s per IP

func realIP(r *http.Request) string {
	if v := r.Header.Get("X-Real-IP"); v != "" {
		return v
	}
	if v := r.Header.Get("X-Forwarded-For"); v != "" {
		if i := strings.Index(v, ","); i != -1 {
			return strings.TrimSpace(v[:i])
		}
		return strings.TrimSpace(v)
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	return ip
}

// RateLimitLogin limits POST /auth/login to 5 requests per 10 seconds per IP.
func RateLimitLogin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := realIP(r)
		if !loginLimiter.get(ip).Allow() {
			http.Error(w, `{"error":"too many requests"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}
