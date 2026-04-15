# Makefile
.PHONY: dev up down full full-down build migrate-up migrate-down migrate-create sqlc test

# Start Docker services (db + redis only)
up:
	docker compose up -d

# Stop Docker services
down:
	docker compose down

# Run backend in development mode (db + redis in Docker, backend locally)
dev: up
	cd backend && go run main.go

# Start full stack in Docker (db + redis + backend)
full:
	docker compose --profile full up -d --build

# Stop full stack
full-down:
	docker compose --profile full down

# Build backend Docker image
build:
	docker compose --profile full build

# Run migrations up
migrate-up: up
	cd backend && goose -dir db/migrations postgres "$(DATABASE_URL)" up

# Run migrations down one step
migrate-down:
	cd backend && goose -dir db/migrations postgres "$(DATABASE_URL)" down

# Create a new migration
migrate-create:
	cd backend && goose -dir db/migrations create $(name) sql

# Generate sqlc code
sqlc:
	cd backend && sqlc generate

# Run tests
test: up
	cd backend && go test ./... -v -count=1

# Include .env if it exists
-include .env
export
