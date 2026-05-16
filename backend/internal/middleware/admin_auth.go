package middleware

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
)

func AuthenticateAdmin(jwtSvc *domain.JWTService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw := extractBearer(r)
			if raw == "" {
				writeErr(w, http.StatusUnauthorized, "missing bearer token")
				return
			}

			claims, err := jwtSvc.ParseAccessToken(raw)
			if err != nil {
				if errors.Is(err, domain.ErrExpired) {
					writeErr(w, http.StatusUnauthorized, "token expired")
					return
				}
				writeErr(w, http.StatusUnauthorized, "unauthorized")
				return
			}

			ctx := withUserClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequirePermission(permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := UserClaimsFromContext(r.Context())
			if claims == nil {
				writeErr(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if !claims.HasPermission(permission) {
				writeErr(w, http.StatusForbidden, "forbidden")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireTenantMatch ensures the {tenantId} URL parameter matches the authenticated
// user's tenant. Users with view-any:tenant (super-admins) bypass the check.
func RequireTenantMatch(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := UserClaimsFromContext(r.Context())
		if claims == nil {
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		tenantID := chi.URLParam(r, "tenantId")
		if tenantID != "" && tenantID != claims.TenantID && !claims.HasPermission("view-any:tenant") {
			writeErr(w, http.StatusForbidden, "forbidden")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func extractBearer(r *http.Request) string {
	raw := r.Header.Get("Authorization")
	if len(raw) > 7 && strings.EqualFold(raw[:7], "bearer ") {
		return raw[7:]
	}
	return ""
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
