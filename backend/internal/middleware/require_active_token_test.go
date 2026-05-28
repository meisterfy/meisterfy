package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/stretchr/testify/assert"
)

type stubVersionChecker struct {
	version int
	err     error
}

func (s stubVersionChecker) GetTokenVersion(_ context.Context, _ string) (int, error) {
	return s.version, s.err
}

func reqWithClaims(claims *domain.UserClaims) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	if claims != nil {
		r = r.WithContext(WithUserClaims(r.Context(), claims))
	}
	return r
}

func TestRequireActiveToken_MatchingVersionAllows(t *testing.T) {
	t.Parallel()
	h := RequireActiveToken(stubVersionChecker{version: 3})(okHandler())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, reqWithClaims(&domain.UserClaims{UserID: "u1", TokenVersion: 3}))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequireActiveToken_StaleVersionRejected(t *testing.T) {
	t.Parallel()
	h := RequireActiveToken(stubVersionChecker{version: 4})(okHandler())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, reqWithClaims(&domain.UserClaims{UserID: "u1", TokenVersion: 3}))
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireActiveToken_NoClaims(t *testing.T) {
	t.Parallel()
	h := RequireActiveToken(stubVersionChecker{version: 0})(okHandler())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, reqWithClaims(nil))
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireActiveToken_CheckerErrorRejected(t *testing.T) {
	t.Parallel()
	h := RequireActiveToken(stubVersionChecker{err: errors.New("db down")})(okHandler())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, reqWithClaims(&domain.UserClaims{UserID: "u1", TokenVersion: 0}))
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
