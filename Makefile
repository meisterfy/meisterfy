.PHONY: dev/backend dev/frontend build migrate/up migrate/down migrate/status \
        migrate/create test/backend test/frontend lint sqlc

# ── Dev ───────────────────────────────────────────────────────────────────────

dev/backend:
	cd backend && $(shell which air 2>/dev/null || echo $(HOME)/go/bin/air) || go run ./cmd/server

dev/frontend:
	cd frontend && bun run dev

# ── Build ─────────────────────────────────────────────────────────────────────

build:
	cd frontend && bun run build
	cd backend && go build -o bin/server ./cmd/server

# ── Migrations ────────────────────────────────────────────────────────────────

migrate/up:
	cd backend && go run ./cmd/migrate up

migrate/down:
	cd backend && go run ./cmd/migrate down

migrate/status:
	cd backend && go run ./cmd/migrate status

migrate/create:
	@read -p "Migration name: " name; \
	cd backend && goose -dir migrations create $$name sql

# ── Test ─────────────────────────────────────────────────────────────────────

test/backend:
	cd backend && go test ./...

test/frontend:
	cd frontend && bun run test

# ── Quality ───────────────────────────────────────────────────────────────────

lint:
	cd backend && golangci-lint run ./...
	cd frontend && bun run lint

sqlc:
	cd backend && sqlc generate
