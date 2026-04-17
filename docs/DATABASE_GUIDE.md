# Database Persistence & Deployment Guide

## How Data Survives Updates

Court Command uses **Goose** for schema migrations. The backend runs all pending migrations automatically on startup (`db.RunMigrations()` in `backend/main.go`). This means:

- New schema changes (tables, columns, indexes) are applied automatically when you deploy a new version.
- **Existing data is never touched** — migrations only ADD structure, they never DROP or TRUNCATE.
- The `goose_db_version` table tracks which migrations have already been applied. Only new ones run.

There are currently **30 migration files** in `backend/db/migrations/` (00001 through 00030).

---

## Golden Rules

### 1. Never modify an existing migration file

Once a migration has been applied to any database (dev, staging, production), its SQL is locked. If you need to change a table, create a **new** migration file:

```
backend/db/migrations/00031_add_whatever.sql
```

### 2. Never use DROP TABLE in a migration

Use `ALTER TABLE` to add/modify columns. If you must remove a column, use `ALTER TABLE ... DROP COLUMN` in a new migration — but think twice about whether you actually need to.

### 3. Never run `docker compose down -v`

The `-v` flag **destroys named volumes**, which is where PostgreSQL stores all data. Use `docker compose down` (without `-v`) to stop services while keeping data.

```bash
# Safe — stops containers, keeps data
docker compose down

# DANGEROUS — destroys all data
docker compose down -v
```

### 4. Backup before every deploy

```bash
# Quick backup to a SQL file
make backup

# Or manually:
docker exec courtcommand-db pg_dump -U courtcommand courtcommand > backup-$(date +%Y%m%d-%H%M%S).sql
```

### 5. Never run the reset endpoint in production

`POST /api/v1/admin/reset-db` exists for development only. It drops all tables. This endpoint should be removed or disabled before production deployment.

---

## Docker Volume Persistence

The `docker-compose.yml` uses a named volume for PostgreSQL:

```yaml
volumes:
  courtcommand-data:
```

This volume persists across:
- `docker compose stop` / `docker compose start`
- `docker compose down` / `docker compose up`
- `docker compose restart`
- Host machine reboots
- Container image rebuilds

It does **NOT** persist across:
- `docker compose down -v` (explicitly removes volumes)
- `docker volume rm courtcommand-data`
- Uninstalling Docker

---

## Deployment Workflow

### Development (local)

```bash
# Start database + Redis
make dev

# Backend auto-runs migrations on startup
cd backend && go run .
```

### Production (Docker Compose)

```bash
# 1. Backup current data
make backup

# 2. Pull latest code
git pull origin V2

# 3. Rebuild and restart (data persists)
docker compose --profile full down
docker compose --profile full up -d --build

# 4. Verify migrations applied
docker logs courtcommand-backend 2>&1 | grep -i migrat
```

### Production (Coolify)

Coolify handles the Docker build and restart automatically. Migrations run on backend startup. Ensure:
- The PostgreSQL volume is configured as persistent in Coolify's service settings
- `DATABASE_URL` environment variable points to the persistent database
- Backup before triggering a new deployment

---

## Restoring from Backup

```bash
# Stop the backend first to avoid conflicts
docker compose stop backend

# Restore
cat backup-20260417-120000.sql | docker exec -i courtcommand-db psql -U courtcommand courtcommand

# Restart
docker compose start backend
```

---

## Adding New Migrations

```bash
# Create a new migration file
touch backend/db/migrations/00031_describe_change.sql
```

File format (Goose SQL):

```sql
-- +goose Up
ALTER TABLE teams ADD COLUMN website_url TEXT;

-- +goose Down
ALTER TABLE teams DROP COLUMN IF EXISTS website_url;
```

Rules for the `-- +goose Down` section:
- Always include it for reversibility
- Use `IF EXISTS` / `IF NOT EXISTS` to make it idempotent
- If the Down migration would lose data (dropping a column with values), add a comment warning about it

---

## Checking Migration Status

```bash
# See which migrations have been applied
docker exec courtcommand-db psql -U courtcommand courtcommand \
  -c "SELECT version_id, is_applied, tstamp FROM goose_db_version ORDER BY version_id;"
```

---

## Emergency: Data Recovery

If data is lost (someone ran `-v` or the volume was deleted):

1. Restore from the most recent backup file
2. If no backup exists, the schema can be recreated by starting the backend (migrations run automatically), but **all data is gone**
3. This is why `make backup` before every deploy is critical

---

## Backup & Restore Commands

| Command | What it does |
|---------|-------------|
| `make backup` | Quick database-only backup to `backups/db-TIMESTAMP.sql` |
| `make backup-full` | Database + uploaded files (logos, photos) to `backups/` |
| `make backup-before-deploy` | Alias for `backup-full` — run before every deploy |
| `make backup-list` | Show all available backups with sizes |
| `make restore-db FILE=backups/db-XXX.sql` | Restore database from a specific backup (requires YES confirmation) |
| `make restore-uploads FILE=backups/uploads-XXX.tar.gz` | Restore uploaded files from a backup |

### Restore workflow after a bad deploy

```sh
# 1. Stop the backend
# 2. Restore the database
make restore-db FILE=backups/db-20260417-120000.sql
# 3. Restore uploads if needed
make restore-uploads FILE=backups/uploads-20260417-120000.tar.gz
# 4. Roll back to the previous code version (git checkout or Docker image tag)
# 5. Restart the backend
```

---

## Production Backup Strategy

For production (Coolify / VPS / cloud), implement these in addition to the local Makefile targets:

### 1. Automated daily backups

```sh
# Cron job (add to server's crontab)
# Daily at 3 AM UTC — dumps DB, compresses, stores locally
0 3 * * * docker exec courtcommand-db pg_dump -U courtcommand courtcommand | gzip > /opt/backups/db-$(date +\%Y\%m\%d).sql.gz

# Weekly on Sunday — full backup including uploads
0 4 * * 0 tar czf /opt/backups/full-$(date +\%Y\%m\%d).tar.gz /opt/backups/db-$(date +\%Y\%m\%d).sql.gz /app/backend/uploads/
```

### 2. Offsite storage (recommended)

Push backups to S3-compatible storage (Backblaze B2 is ~$0.005/GB/month):

```sh
# After each backup, sync to B2/S3
aws s3 sync /opt/backups/ s3://courtcommand-backups/ --storage-class STANDARD_IA
```

Or use Coolify's built-in backup destinations (Settings → Backup → add S3/B2 target).

### 3. Retention policy

| Period | Keep | Example |
|--------|------|---------|
| Daily | 7 backups | Mon–Sun |
| Weekly | 4 backups | Last 4 Sundays |
| Monthly | 3 backups | Last 3 month-ends |

```sh
# Cleanup old daily backups (keep last 7)
find /opt/backups/ -name "db-*.sql.gz" -mtime +7 -delete
```

### 4. Pre-deploy hook

Add to your deploy script (or Coolify post-build command):

```sh
# Run before pulling new code / restarting containers
docker exec courtcommand-db pg_dump -U courtcommand courtcommand | gzip > /opt/backups/pre-deploy-$(date +%Y%m%d-%H%M%S).sql.gz
```

### 5. Test your backups

Regularly (monthly) verify backups are restorable:

```sh
# Spin up a temporary Postgres, restore, verify
docker run --rm -e POSTGRES_PASSWORD=test -v /opt/backups/db-latest.sql.gz:/backup.sql.gz postgres:17-alpine \
  sh -c "gunzip /backup.sql.gz && psql -U postgres -f /backup.sql"
```

---

## Make Targets

| Command | What it does |
|---------|-------------|
| `make dev` | Start db + redis (dev mode) |
| `make full` | Start full stack in Docker |
| `make backup` | Quick database backup |
| `make backup-full` | Database + uploads backup |
| `make backup-before-deploy` | Pre-deploy safety backup |
| `make backup-list` | List available backups |
| `make restore-db FILE=...` | Restore database |
| `make restore-uploads FILE=...` | Restore uploaded files |
| `make test` | Run all backend tests |
