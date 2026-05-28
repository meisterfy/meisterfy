package domain

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	accessTokenTTL     = 15 * time.Minute
	refreshTokenTTL    = 7 * 24 * time.Hour
	jwtIssuer          = "meisterfy"
	jwtAudience        = "meisterfy-api"
	jwtRefreshAudience = "meisterfy-refresh"
)

type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
}

type JWTService struct {
	secret []byte
}

func NewJWTService(secret string) *JWTService {
	return &JWTService{secret: []byte(secret)}
}

type accessClaims struct {
	jwt.RegisteredClaims
	TenantID     string   `json:"tid"`
	Permissions  []string `json:"perms"`
	UserName     string   `json:"uname,omitempty"`
	SystemRole   string   `json:"sr,omitempty"`
	TokenVersion int      `json:"tv"`
}

type refreshClaims struct {
	jwt.RegisteredClaims
	TenantID     string `json:"tid"`
	TokenVersion int    `json:"tv"`
}

func (s *JWTService) IssueTokenPair(claims UserClaims) (TokenPair, error) {
	now := time.Now()
	accessExp := now.Add(accessTokenTTL)
	refreshExp := now.Add(refreshTokenTTL)

	ac := accessClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   claims.UserID,
			Issuer:    jwtIssuer,
			Audience:  jwt.ClaimStrings{jwtAudience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(accessExp),
		},
		TenantID:     claims.TenantID,
		Permissions:  claims.Permissions,
		UserName:     claims.UserName,
		SystemRole:   claims.SystemRole,
		TokenVersion: claims.TokenVersion,
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, ac).SignedString(s.secret)
	if err != nil {
		return TokenPair{}, fmt.Errorf("sign access token: %w", err)
	}

	rc := refreshClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   claims.UserID,
			Issuer:    jwtIssuer,
			Audience:  jwt.ClaimStrings{jwtRefreshAudience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(refreshExp),
		},
		TenantID:     claims.TenantID,
		TokenVersion: claims.TokenVersion,
	}
	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, rc).SignedString(s.secret)
	if err != nil {
		return TokenPair{}, fmt.Errorf("sign refresh token: %w", err)
	}

	return TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    accessExp,
	}, nil
}

func (s *JWTService) ParseAccessToken(token string) (*UserClaims, error) {
	var ac accessClaims
	_, err := jwt.ParseWithClaims(token, &ac, s.keyFunc,
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(jwtIssuer),
		jwt.WithAudience(jwtAudience),
	)
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpired
		}
		return nil, ErrUnauthorized
	}
	return &UserClaims{
		UserID:       ac.Subject,
		TenantID:     ac.TenantID,
		Permissions:  ac.Permissions,
		UserName:     ac.UserName,
		SystemRole:   ac.SystemRole,
		TokenVersion: ac.TokenVersion,
	}, nil
}

func (s *JWTService) ParseRefreshToken(token string) (userID, tenantID string, tokenVersion int, err error) {
	var rc refreshClaims
	_, parseErr := jwt.ParseWithClaims(token, &rc, s.keyFunc,
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(jwtIssuer),
		jwt.WithAudience(jwtRefreshAudience),
	)
	if parseErr != nil {
		if errors.Is(parseErr, jwt.ErrTokenExpired) {
			return "", "", 0, ErrExpired
		}
		return "", "", 0, ErrUnauthorized
	}
	return rc.Subject, rc.TenantID, rc.TokenVersion, nil
}

func (s *JWTService) keyFunc(_ *jwt.Token) (any, error) {
	return s.secret, nil
}
