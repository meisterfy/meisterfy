.PHONY: dev/backend dev/frontend build migrate/up migrate/down migrate/status \
        migrate/create test/backend test/backend/unit test/backend/integration \
        test/backend/cover test/frontend test/e2e test/e2e/ui test/e2e/report \
        lint sqlc smoke smoke/remote

# Dev Server

dev/backend:
	cd backend && DEV_FRONTEND_URL=http://localhost:5173 $(shell which air 2>/dev/null || echo $(HOME)/go/bin/air) || DEV_FRONTEND_URL=http://localhost:5173 go run ./cmd/server

dev/frontend:
	cd frontend && bun run dev

dev/bundle:
	@bunx concurrently -k -n "go,svelte,locale,aipim" -c "blue,magenta,yellow,cyan" \
		"make dev/backend" \
		"make dev/frontend" \
		"make dev/frontend/locale" \
		"aipim ui"

# Build

build:
	cd frontend && bun run build
	cd backend && go build -o bin/server ./cmd/server

# Migrations

migrate/up:
	cd backend && go run ./cmd/migrate up

migrate/down:
	cd backend && go run ./cmd/migrate down

migrate/status:
	cd backend && go run ./cmd/migrate status

migrate/create:
	@read -p "Migration name: " name; \
	cd backend && goose -dir migrations create $$name sql

# Test

test/backend:
	cd backend && go test ./...

test/backend/unit:
	cd backend && go test -race -count=1 ./...

test/backend/integration:
	cd backend && go test -tags=integration -race -count=1 ./...

test/backend/cover:
	cd backend && go test -race -coverprofile=coverage.out ./... && go tool cover -html=coverage.out

smoke:
	cd backend && go test -tags=smoke -v ./smoke/...

smoke/remote:
	cd backend && SMOKE_TARGET_URL=$(URL) go test -tags=smoke -v ./smoke/...

test/frontend:
	cd frontend && bun run test

test/e2e:
	cd frontend && bunx playwright test

test/e2e/ui:
	cd frontend && bunx playwright test --ui

test/e2e/report:
	cd frontend && bunx playwright show-report

# Quality

lint:
	cd backend && golangci-lint run ./...
	cd frontend && bun run lint
lint/frontend: 
	cd frontend && bun run lint
lint/backend: 
	cd backend && golangci-lint run ./...

sqlc:
	cd backend && sqlc generate

# Locales

dev/frontend/locale:
	cd frontend && bun run paraglide:watch