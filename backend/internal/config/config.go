package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port             string
	DatabaseURL      string
	JWTSecret        string
	AdminCORSOrigins string
	CookieDomain     string
	AppEnv           string
	BaseURL          string
	StoragePath      string
	SentryDSN        string
	DevFrontendURL   string
	CredentialKey    string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		JWTSecret:        os.Getenv("JWT_SECRET"),
		AdminCORSOrigins: getEnv("ADMIN_CORS_ORIGINS", "http://localhost:5173"),
		CookieDomain:     os.Getenv("COOKIE_DOMAIN"),
		AppEnv:           getEnv("APP_ENV", "development"),
		BaseURL:          getEnv("BASE_URL", "http://localhost:8080"),
		StoragePath:      getEnv("STORAGE_PATH", "./storage/images"),
		SentryDSN:        os.Getenv("SENTRY_DSN"),
		DevFrontendURL:   os.Getenv("DEV_FRONTEND_URL"),
		CredentialKey:    os.Getenv("CREDENTIAL_ENCRYPTION_KEY"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}
	if cfg.CredentialKey != "" {
		n := len(cfg.CredentialKey)
		if n != 16 && n != 24 && n != 32 {
			return nil, fmt.Errorf("CREDENTIAL_ENCRYPTION_KEY must be 16, 24, or 32 bytes (got %d)", n)
		}
	}
	if cfg.AppEnv == "production" && cfg.CredentialKey == "" {
		return nil, fmt.Errorf("CREDENTIAL_ENCRYPTION_KEY is required in production")
	}

	return cfg, nil
}

func (c *Config) IsProduction() bool {
	return c.AppEnv == "production"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
