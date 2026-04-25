.PHONY: dev build migrate migrate-down migrate-status test lint sqlc docker-build

dev:
	air

build:
	go build -o bin/server ./cmd/server

migrate:
	go run ./cmd/migrate up

migrate-down:
	go run ./cmd/migrate down

migrate-status:
	go run ./cmd/migrate status

migrate-create:
	@read -p "Migration name: " name; \
	goose -dir migrations create $$name sql

test:
	go test -v ./...

test-integration:
	go test -v -tags=integration ./...

test-cover:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out

lint:
	golangci-lint run ./...

sqlc:
	sqlc generate

docker-build:
	docker build -t rush-maestro:latest ..
