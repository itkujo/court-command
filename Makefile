# Makefile
.PHONY: dev dev-frontend dev-all up down full full-down build migrate-up migrate-down migrate-create sqlc test backup

# Start Docker services (db + redis only)
up:
	docker compose up -d

# Stop Docker services
down:
	docker compose down

# Run backend in development mode (db + redis in Docker, backend locally)
dev: up
	cd backend && go run main.go

# Run frontend in development mode
dev-frontend:
	cd frontend && pnpm dev

# Run backend + frontend in parallel (db + redis in Docker)
dev-all: up
	$(MAKE) dev & $(MAKE) dev-frontend

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

# Backup database to timestamped SQL file
backup:
	@mkdir -p backups
	docker exec courtcommand-db pg_dump -U courtcommand courtcommand > backups/backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "Backup saved to backups/"

# Include .env if it exists
-include .env
export
