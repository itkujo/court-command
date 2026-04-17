# Makefile
.PHONY: dev dev-frontend dev-all up down full full-down build migrate-up migrate-down migrate-create sqlc test backup backup-full restore restore-db backup-list backup-before-deploy

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

# ---- Backup & Restore ----

# Backup database only (quick, for routine saves)
backup:
	@mkdir -p backups
	@TIMESTAMP=$$(date +%Y%m%d-%H%M%S); \
	docker compose exec -T db pg_dump -U courtcommand courtcommand > backups/db-$$TIMESTAMP.sql && \
	echo "Database backup: backups/db-$$TIMESTAMP.sql ($$(wc -c < backups/db-$$TIMESTAMP.sql | tr -d ' ') bytes)"

# Full backup: database + uploaded files (for before deploys or major changes)
backup-full:
	@mkdir -p backups
	@TIMESTAMP=$$(date +%Y%m%d-%H%M%S); \
	docker compose exec -T db pg_dump -U courtcommand courtcommand > backups/db-$$TIMESTAMP.sql && \
	echo "Database backup: backups/db-$$TIMESTAMP.sql"; \
	if [ -d backend/uploads ] && [ "$$(ls -A backend/uploads 2>/dev/null)" ]; then \
		tar czf backups/uploads-$$TIMESTAMP.tar.gz -C backend uploads && \
		echo "Uploads backup: backups/uploads-$$TIMESTAMP.tar.gz"; \
	else \
		echo "No uploads to backup"; \
	fi; \
	echo "Full backup complete: $$TIMESTAMP"

# Pre-deploy backup (alias — always run before deploying updates)
backup-before-deploy: backup-full
	@echo "Pre-deploy backup complete. Safe to deploy."

# Restore database from a backup file (usage: make restore-db FILE=backups/db-20260417-123456.sql)
restore-db:
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make restore-db FILE=backups/db-YYYYMMDD-HHMMSS.sql"; \
		echo "Available backups:"; \
		ls -la backups/db-*.sql 2>/dev/null || echo "  No database backups found"; \
		exit 1; \
	fi
	@echo "WARNING: This will replace ALL data in the database with the backup."
	@echo "File: $(FILE)"
	@read -p "Type YES to confirm: " confirm; \
	if [ "$$confirm" = "YES" ]; then \
		docker compose exec -T db psql -U courtcommand -d courtcommand -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" && \
		docker compose exec -T db psql -U courtcommand courtcommand < $(FILE) && \
		echo "Database restored from $(FILE)"; \
	else \
		echo "Restore cancelled."; \
	fi

# Restore uploads from a backup file (usage: make restore-uploads FILE=backups/uploads-20260417-123456.tar.gz)
restore-uploads:
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make restore-uploads FILE=backups/uploads-YYYYMMDD-HHMMSS.tar.gz"; \
		echo "Available backups:"; \
		ls -la backups/uploads-*.tar.gz 2>/dev/null || echo "  No upload backups found"; \
		exit 1; \
	fi
	@echo "Restoring uploads from $(FILE)..."
	@tar xzf $(FILE) -C backend/ && echo "Uploads restored."

# List all available backups
backup-list:
	@echo "=== Database Backups ==="
	@ls -lh backups/db-*.sql 2>/dev/null || echo "  None"
	@echo ""
	@echo "=== Upload Backups ==="
	@ls -lh backups/uploads-*.tar.gz 2>/dev/null || echo "  None"

# Include .env if it exists
-include .env
export
