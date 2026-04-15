-- name: CreateSeason :one
INSERT INTO seasons (
    name, slug, league_id, status, start_date, end_date, description,
    notes, roster_confirmation_deadline, standings_method, standings_config
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
) RETURNING *;

-- name: GetSeasonByID :one
SELECT * FROM seasons WHERE id = $1 AND deleted_at IS NULL;

-- name: GetSeasonBySlug :one
SELECT * FROM seasons WHERE league_id = $1 AND slug = $2 AND deleted_at IS NULL;

-- name: ListSeasonsByLeague :many
SELECT * FROM seasons
WHERE league_id = $1 AND deleted_at IS NULL
ORDER BY start_date DESC NULLS LAST, created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountSeasonsByLeague :one
SELECT COUNT(*) FROM seasons
WHERE league_id = $1 AND deleted_at IS NULL;

-- name: UpdateSeason :one
UPDATE seasons SET
    name = COALESCE(sqlc.narg('name'), name),
    slug = COALESCE(sqlc.narg('slug'), slug),
    status = COALESCE(sqlc.narg('status'), status),
    start_date = COALESCE(sqlc.narg('start_date'), start_date),
    end_date = COALESCE(sqlc.narg('end_date'), end_date),
    description = COALESCE(sqlc.narg('description'), description),
    notes = COALESCE(sqlc.narg('notes'), notes),
    roster_confirmation_deadline = COALESCE(sqlc.narg('roster_confirmation_deadline'), roster_confirmation_deadline),
    standings_method = COALESCE(sqlc.narg('standings_method'), standings_method),
    standings_config = COALESCE(sqlc.narg('standings_config'), standings_config),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteSeason :exec
UPDATE seasons SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: SlugExistsSeason :one
SELECT EXISTS(SELECT 1 FROM seasons WHERE league_id = $1 AND slug = $2 AND deleted_at IS NULL);
