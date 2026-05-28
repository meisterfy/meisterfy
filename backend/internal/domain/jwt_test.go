package domain

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestJWTService() *JWTService {
	return NewJWTService("super-secret-test-key-32-bytes!!")
}

func expiredAccessToken(t *testing.T, svc *JWTService, claims UserClaims) string {
	t.Helper()
	past := time.Now().Add(-2 * time.Minute)
	ac := accessClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   claims.UserID,
			Issuer:    jwtIssuer,
			Audience:  jwt.ClaimStrings{jwtAudience},
			IssuedAt:  jwt.NewNumericDate(past.Add(-accessTokenTTL)),
			ExpiresAt: jwt.NewNumericDate(past),
		},
		TenantID:    claims.TenantID,
		Permissions: claims.Permissions,
		UserName:    claims.UserName,
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, ac).SignedString(svc.secret)
	require.NoError(t, err)
	return tok
}

func expiredRefreshToken(t *testing.T, svc *JWTService, userID, tenantID string) string {
	t.Helper()
	past := time.Now().Add(-2 * time.Minute)
	rc := refreshClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    jwtIssuer,
			Audience:  jwt.ClaimStrings{jwtRefreshAudience},
			IssuedAt:  jwt.NewNumericDate(past.Add(-refreshTokenTTL)),
			ExpiresAt: jwt.NewNumericDate(past),
		},
		TenantID: tenantID,
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, rc).SignedString(svc.secret)
	require.NoError(t, err)
	return tok
}

func TestJWTService_IssueAndParseAccessToken(t *testing.T) {
	t.Parallel()
	svc := newTestJWTService()
	in := UserClaims{
		UserID:      "user-1",
		TenantID:    "tenant-1",
		UserName:    "Alice",
		Permissions: []string{"read:post", "write:post"},
	}

	pair, err := svc.IssueTokenPair(in)
	require.NoError(t, err)
	assert.NotEmpty(t, pair.AccessToken)
	assert.NotEmpty(t, pair.RefreshToken)
	assert.True(t, pair.ExpiresAt.After(time.Now()))

	got, err := svc.ParseAccessToken(pair.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, in.UserID, got.UserID)
	assert.Equal(t, in.TenantID, got.TenantID)
	assert.Equal(t, in.UserName, got.UserName)
	assert.Equal(t, in.Permissions, got.Permissions)
}

func TestJWTService_ClaimsRoundTrip(t *testing.T) {
	t.Parallel()
	svc := newTestJWTService()
	tests := []struct {
		name   string
		claims UserClaims
	}{
		{
			"all fields populated",
			UserClaims{
				UserID:      "u-abc",
				TenantID:    "t-xyz",
				UserName:    "Bob",
				Permissions: []string{"admin:tenant", "read:post", "write:post"},
			},
		},
		{
			"empty permissions",
			UserClaims{
				UserID:      "u-123",
				TenantID:    "t-456",
				UserName:    "",
				Permissions: []string{},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			pair, err := svc.IssueTokenPair(tt.claims)
			require.NoError(t, err)
			got, err := svc.ParseAccessToken(pair.AccessToken)
			require.NoError(t, err)
			assert.Equal(t, tt.claims.UserID, got.UserID)
			assert.Equal(t, tt.claims.TenantID, got.TenantID)
			assert.Equal(t, tt.claims.UserName, got.UserName)
			assert.Equal(t, tt.claims.Permissions, got.Permissions)
		})
	}
}

func TestJWTService_ParseAccessToken_Expired(t *testing.T) {
	t.Parallel()
	svc := newTestJWTService()
	tok := expiredAccessToken(t, svc, UserClaims{UserID: "u-1", TenantID: "t-1"})
	_, err := svc.ParseAccessToken(tok)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrExpired)
}

func TestJWTService_ParseAccessToken_WrongSecret(t *testing.T) {
	t.Parallel()
	svc1 := newTestJWTService()
	svc2 := NewJWTService("completely-different-secret-key!!")

	pair, err := svc1.IssueTokenPair(UserClaims{UserID: "u-1", TenantID: "t-1"})
	require.NoError(t, err)

	_, err = svc2.ParseAccessToken(pair.AccessToken)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUnauthorized)
}

func TestJWTService_ParseAccessToken_Tampered(t *testing.T) {
	t.Parallel()
	svc := newTestJWTService()
	pair, err := svc.IssueTokenPair(UserClaims{UserID: "u-1", TenantID: "t-1"})
	require.NoError(t, err)

	tampered := pair.AccessToken + "tampered"
	_, err = svc.ParseAccessToken(tampered)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUnauthorized)
}

func TestJWTService_IssueAndParseRefreshToken(t *testing.T) {
	t.Parallel()
	svc := newTestJWTService()
	in := UserClaims{
		UserID:   "user-2",
		TenantID: "tenant-2",
	}

	pair, err := svc.IssueTokenPair(in)
	require.NoError(t, err)

	userID, tenantID, err := svc.ParseRefreshToken(pair.RefreshToken)
	require.NoError(t, err)
	assert.Equal(t, in.UserID, userID)
	assert.Equal(t, in.TenantID, tenantID)
}

func TestJWTService_ParseRefreshToken_Expired(t *testing.T) {
	t.Parallel()
	svc := newTestJWTService()
	tok := expiredRefreshToken(t, svc, "u-1", "t-1")
	_, _, err := svc.ParseRefreshToken(tok)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrExpired)
}

// Access and refresh tokens use distinct audiences so one cannot be replayed
// as the other (e.g. exchanging a short-lived access token for a 7-day refresh).
func TestJWTService_TokenTypesAreNotInterchangeable(t *testing.T) {
	t.Parallel()
	svc := newTestJWTService()
	pair, err := svc.IssueTokenPair(UserClaims{UserID: "u1", TenantID: "t1"})
	require.NoError(t, err)

	_, _, err = svc.ParseRefreshToken(pair.AccessToken)
	require.Error(t, err, "access token must not be valid as a refresh token")

	_, err = svc.ParseAccessToken(pair.RefreshToken)
	require.Error(t, err, "refresh token must not be valid as an access token")
}
