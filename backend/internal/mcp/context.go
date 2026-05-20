package mcp

import "context"

type contextKey string

const (
	tenantIDKey contextKey = "mcp_tenant_id"
	roleKey     contextKey = "mcp_role"
)

func TenantIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(tenantIDKey).(string)
	return v, ok && v != ""
}

func RoleFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(roleKey).(string)
	return v, ok && v != ""
}

func WithTenantID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, tenantIDKey, id)
}

func WithRole(ctx context.Context, role string) context.Context {
	return context.WithValue(ctx, roleKey, role)
}
