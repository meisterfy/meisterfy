package testutil

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"testing"

	embeddedpostgres "github.com/fergusstrange/embedded-postgres"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pressly/goose/v3"
)

// PostgresContainer wraps either an embedded-postgres instance or an external DB connection.
type PostgresContainer struct {
	Pool     *pgxpool.Pool
	DSN      string
	embedded *embeddedpostgres.EmbeddedPostgres // nil if using external DB
}

// NewPostgresContainer starts an embedded Postgres instance (or connects to an external one via
// TEST_DATABASE_URL), runs goose migrations, and returns a connection pool.
//
// When t is nil (called from TestMain), cleanup must be managed manually via Cleanup().
// When t is non-nil, a t.Cleanup() hook is registered automatically.
func NewPostgresContainer(t testing.TB) *PostgresContainer {
	ctx := context.Background()

	// Locate migrations directory relative to this source file.
	_, b, _, _ := runtime.Caller(0)
	projectRoot := filepath.Join(filepath.Dir(b), "..")
	migrationsDir := filepath.Join(projectRoot, "migrations")

	var (
		pc  *PostgresContainer
		err error
	)

	if dsn := os.Getenv("TEST_DATABASE_URL"); dsn != "" {
		// CI / external postgres path.
		pc, err = connectExternal(ctx, dsn, migrationsDir)
		if err != nil {
			fatalf(t, "connect to external postgres: %v", err)
			return nil
		}
	} else {
		// Embedded postgres path.
		pc, err = startEmbedded(ctx, migrationsDir)
		if err != nil {
			fatalf(t, "start embedded postgres: %v", err)
			return nil
		}
	}

	if t != nil {
		t.Cleanup(func() {
			pc.Cleanup(context.Background())
		})
	}

	return pc
}

// startEmbedded starts an embedded Postgres instance and runs goose migrations.
func startEmbedded(ctx context.Context, migrationsDir string) (*PostgresContainer, error) {
	port := rand.Intn(10000) + 15432 //nolint:gosec

	cfg := embeddedpostgres.DefaultConfig().
		Database("testdb").
		Username("test").
		Password("test").
		Port(uint32(port)) //nolint:gosec // port is a valid TCP port number (1-65535)

	ep := embeddedpostgres.NewDatabase(cfg)
	if err := ep.Start(); err != nil {
		return nil, fmt.Errorf("start embedded postgres: %w", err)
	}

	dsn := fmt.Sprintf("postgres://test:test@localhost:%d/testdb?sslmode=disable", port)

	if err := runMigrations(ctx, dsn, migrationsDir); err != nil {
		_ = ep.Stop()
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		_ = ep.Stop()
		return nil, fmt.Errorf("create pgx pool: %w", err)
	}

	return &PostgresContainer{
		Pool:     pool,
		DSN:      dsn,
		embedded: ep,
	}, nil
}

// connectExternal connects to an external postgres instance and runs goose migrations.
func connectExternal(ctx context.Context, dsn, migrationsDir string) (*PostgresContainer, error) {
	if err := runMigrations(ctx, dsn, migrationsDir); err != nil {
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("create pgx pool: %w", err)
	}

	return &PostgresContainer{
		Pool: pool,
		DSN:  dsn,
	}, nil
}

// runMigrations applies all goose migrations to the given DSN.
func runMigrations(ctx context.Context, dsn, migrationsDir string) error {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return fmt.Errorf("open sql db: %w", err)
	}
	defer db.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}
	if err := goose.UpContext(ctx, db, migrationsDir); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}
	return nil
}

// Cleanup closes the pool and stops the embedded postgres instance (if any).
func (pc *PostgresContainer) Cleanup(ctx context.Context) {
	if pc.Pool != nil {
		pc.Pool.Close()
	}
	if pc.embedded != nil {
		if err := pc.embedded.Stop(); err != nil {
			log.Printf("failed to stop embedded postgres: %v", err)
		}
	}
}

// ResetDB truncates all user tables (dynamically queried from information_schema) and
// restarts their identity sequences. Safe to call between tests.
func (pc *PostgresContainer) ResetDB(t testing.TB) {
	t.Helper()
	ctx := context.Background()

	rows, err := pc.Pool.Query(ctx, `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public'
		  AND table_type = 'BASE TABLE'
		  AND table_name NOT IN ('goose_db_version')
	`)
	if err != nil {
		t.Fatalf("query tables for reset: %v", err)
	}

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("scan table name: %v", err)
		}
		tables = append(tables, name)
	}
	rows.Close()

	if len(tables) == 0 {
		return
	}

	// Sort for deterministic lock-acquisition order across concurrent callers.
	sort.Strings(tables)

	// Build a single TRUNCATE statement for all tables.
	query := "TRUNCATE TABLE "
	for i, tbl := range tables {
		if i > 0 {
			query += ", "
		}
		query += fmt.Sprintf("%q", tbl)
	}
	query += " RESTART IDENTITY CASCADE"

	if _, err := pc.Pool.Exec(ctx, query); err != nil {
		t.Fatalf("truncate tables: %v", err)
	}
}

// MustEnv returns an env var or skips the test.
func MustEnv(t testing.TB, key string) string {
	v := os.Getenv(key)
	if v == "" {
		t.Skipf("SKIP: %s not set", key)
	}
	return v
}

// fatalf calls t.Fatalf when t is non-nil, otherwise log.Fatalf.
func fatalf(t testing.TB, format string, args ...any) {
	if t != nil {
		t.Fatalf(format, args...)
	} else {
		log.Fatalf(format, args...)
	}
}
