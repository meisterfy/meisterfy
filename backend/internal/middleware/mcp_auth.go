package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/meisterfy/meisterfy/internal/mcp"
	"github.com/meisterfy/meisterfy/internal/repository"
)

type mcpApiKeyRepository interface {
	GetByHash(ctx context.Context, keyHash string) (repository.McpApiKey, error)
	UpdateLastUsed(ctx context.Context, id string) error
}

func AuthenticateMCPKey(keyRepo mcpApiKeyRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractMCPToken(r)
			if token == "" {
				writeErr(w, http.StatusUnauthorized, "missing API key")
				return
			}

			hash := sha256Hex(token)
			key, err := keyRepo.GetByHash(r.Context(), hash)
			if err != nil {
				writeErr(w, http.StatusUnauthorized, "invalid API key")
				return
			}

			if key.RevokedAt != nil {
				writeErr(w, http.StatusUnauthorized, "API key revoked")
				return
			}

			if key.ExpiresAt != nil && time.Now().After(*key.ExpiresAt) {
				writeErr(w, http.StatusUnauthorized, "API key expired")
				return
			}

			go keyRepo.UpdateLastUsed(context.Background(), key.ID) //nolint:errcheck

			ctx := mcp.WithTenantID(r.Context(), key.TenantID)
			ctx = mcp.WithRole(ctx, key.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func extractMCPToken(r *http.Request) string {
	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return r.Header.Get("X-API-Key")
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}
