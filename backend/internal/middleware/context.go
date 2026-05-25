package middleware

import (
	"context"

	"github.com/meisterfy/meisterfy/internal/domain"
)

type contextKey string

const contextKeyUserClaims contextKey = "user_claims"

func UserClaimsFromContext(ctx context.Context) *domain.UserClaims {
	claims, _ := ctx.Value(contextKeyUserClaims).(*domain.UserClaims)
	return claims
}

func withUserClaims(ctx context.Context, claims *domain.UserClaims) context.Context {
	return context.WithValue(ctx, contextKeyUserClaims, claims)
}

// WithUserClaims attaches JWT claims to ctx (tests and internal use).
func WithUserClaims(ctx context.Context, claims *domain.UserClaims) context.Context {
	return withUserClaims(ctx, claims)
}
