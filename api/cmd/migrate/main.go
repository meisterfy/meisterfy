package main

import (
	"context"
	"database/sql"
	"log/slog"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
)

func main() {
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		slog.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		slog.Error("db open error", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		slog.Error("goose dialect error", "err", err)
		os.Exit(1)
	}

	args := os.Args[1:]
	if len(args) == 0 {
		args = []string{"up"}
	}

	if err := goose.RunContext(context.Background(), args[0], db, "migrations"); err != nil {
		slog.Error("migration error", "err", err)
		os.Exit(1)
	}
}
