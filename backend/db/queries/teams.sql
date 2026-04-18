-- name: CreateTeam :one
INSERT INTO teams (name, short_name, slug, logo_url, primary_color, secondary_color, org_id, city, founded_year, bio)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetTeamByID :one
SELECT * FROM teams
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetTeamBySlug :one
SELECT * FROM teams
WHERE slug = $1 AND deleted_at IS NULL;

-- name: UpdateTeam :one
UPDATE teams SET
    name = COALESCE(sqlc.narg('name'), name),
    short_name = COALESCE(sqlc.narg('short_name'), short_name),
    logo_url = COALESCE(sqlc.narg('logo_url'), logo_url),
    primary_color = COALESCE(sqlc.narg('primary_color'), primary_color),
    secondary_color = COALESCE(sqlc.narg('secondary_color'), secondary_color),
    city = COALESCE(sqlc.narg('city'), city),
    founded_year = COALESCE(sqlc.narg('founded_year'), founded_year),
    bio = COALESCE(sqlc.narg('bio'), bio),
    updated_at = now()
WHERE id = @team_id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteTeam :exec
UPDATE teams SET
    deleted_at = now(),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListTeams :many
SELECT * FROM teams
WHERE deleted_at IS NULL
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountTeams :one
SELECT count(*) FROM teams
WHERE deleted_at IS NULL;

-- name: ListTeamsByOrg :many
SELECT * FROM teams
WHERE org_id = $1 AND deleted_at IS NULL
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: CountTeamsByOrg :one
SELECT count(*) FROM teams
WHERE org_id = $1 AND deleted_at IS NULL;

-- name: SearchTeams :many
SELECT * FROM teams
WHERE deleted_at IS NULL
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR short_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('org_id')::BIGINT IS NULL OR org_id = sqlc.narg('org_id')::BIGINT)
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountSearchTeams :one
SELECT count(*) FROM teams
WHERE deleted_at IS NULL
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR short_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('org_id')::BIGINT IS NULL OR org_id = sqlc.narg('org_id')::BIGINT)
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT);

-- name: GetTeamsByIDs :many
SELECT * FROM teams
WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL;

-- name: CheckTeamSlugExists :one
SELECT count(*) FROM teams
WHERE slug = $1 AND deleted_at IS NULL;
