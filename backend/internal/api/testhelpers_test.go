package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/stretchr/testify/require"
)

const testAPISecret = "test-api-secret-key-32-bytes!!"

func newTestJWT() *domain.JWTService {
	return domain.NewJWTService(testAPISecret)
}

func issueTestToken(t *testing.T, svc *domain.JWTService, claims domain.UserClaims) string {
	t.Helper()
	pair, err := svc.IssueTokenPair(claims)
	require.NoError(t, err)
	return pair.AccessToken
}

func withChiParam(r *http.Request, key, val string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, val)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func withChiParams(r *http.Request, params map[string]string) *http.Request {
	rctx := chi.NewRouteContext()
	for k, v := range params {
		rctx.URLParams.Add(k, v)
	}
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func jsonBody(v any) io.Reader {
	b, _ := json.Marshal(v)
	return strings.NewReader(string(b))
}

// mockAudit is a no-op AuditLogRepo for handler tests that don't exercise audit paths.
type mockAudit struct{}

func (m *mockAudit) Log(_ context.Context, _ domain.AuditEntry) error { return nil }
func (m *mockAudit) List(_ context.Context, _ domain.AuditLogFilter) ([]*domain.AuditEntry, int64, error) {
	return nil, 0, nil
}
func (m *mockAudit) AsyncLog(_ domain.AuditEntry) {}
