package middleware

import (
	"net/http"

	"github.com/getsentry/sentry-go"
)

// SentryRecovery captures panics and sends them to Sentry before re-panicking.
func SentryRecovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hub := sentry.GetHubFromContext(r.Context())
		if hub == nil {
			hub = sentry.CurrentHub().Clone()
			r = r.WithContext(sentry.SetHubOnContext(r.Context(), hub))
		}
		hub.Scope().SetRequest(r)
		defer func() {
			if err := recover(); err != nil {
				hub.RecoverWithContext(r.Context(), err)
				panic(err)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// SentryHubMiddleware attaches a fresh Sentry hub to every request.
func SentryHubMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hub := sentry.CurrentHub().Clone()
		r = r.WithContext(sentry.SetHubOnContext(r.Context(), hub))
		next.ServeHTTP(w, r)
	})
}
