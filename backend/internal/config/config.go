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
	MCPAPIKey        string
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
		MCPAPIKey:        os.Getenv("MCP_API_KEY"),
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
