-- name: CreateCourt :one
INSERT INTO courts (
    name, slug, venue_id, surface_type, is_show_court, is_active,
    is_temporary, sort_order, notes, stream_url, stream_type,
    stream_is_live, stream_title, created_by_user_id
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11,
    $12, $13, $14
)
RETURNING *;

-- name: GetCourtByID :one
SELECT * FROM courts
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetCourtBySlug :one
SELECT * FROM courts
WHERE slug = $1 AND venue_id = $2 AND deleted_at IS NULL;

-- name: GetFloatingCourtBySlug :one
SELECT * FROM courts
WHERE slug = $1 AND venue_id IS NULL AND deleted_at IS NULL;

-- name: UpdateCourt :one
UPDATE courts SET
    name = COALESCE(sqlc.narg('name'), name),
    surface_type = COALESCE(sqlc.narg('surface_type'), surface_type),
    is_show_court = COALESCE(sqlc.narg('is_show_court'), is_show_court),
    is_active = COALESCE(sqlc.narg('is_active'), is_active),
    is_temporary = COALESCE(sqlc.narg('is_temporary'), is_temporary),
    sort_order = COALESCE(sqlc.narg('sort_order'), sort_order),
    notes = COALESCE(sqlc.narg('notes'), notes),
    stream_url = COALESCE(sqlc.narg('stream_url'), stream_url),
    stream_type = COALESCE(sqlc.narg('stream_type'), stream_type),
    stream_is_live = COALESCE(sqlc.narg('stream_is_live'), stream_is_live),
    stream_title = COALESCE(sqlc.narg('stream_title'), stream_title),
    updated_at = now()
WHERE id = @court_id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteCourt :exec
UPDATE courts SET
    deleted_at = now(),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListCourtsByVenue :many
SELECT * FROM courts
WHERE venue_id = $1 AND deleted_at IS NULL
ORDER BY sort_order, name;

-- name: ListFloatingCourts :many
SELECT * FROM courts
WHERE venue_id IS NULL AND deleted_at IS NULL
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountFloatingCourts :one
SELECT count(*) FROM courts
WHERE venue_id IS NULL AND deleted_at IS NULL;

-- name: GetCourtsByIDs :many
SELECT * FROM courts
WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL;

-- name: CheckCourtSlugInVenue :one
SELECT count(*) FROM courts
WHERE slug = $1 AND venue_id = $2 AND deleted_at IS NULL;

-- name: CheckFloatingCourtSlug :one
SELECT count(*) FROM courts
WHERE slug = $1 AND venue_id IS NULL AND deleted_at IS NULL;

-- name: ArchiveTemporaryCourts :exec
UPDATE courts SET
    deleted_at = now(),
    updated_at = now()
WHERE venue_id = $1 AND is_temporary = true AND deleted_at IS NULL;

-- name: CountCourts :one
SELECT count(*) FROM courts
WHERE deleted_at IS NULL;

-- name: ListCourts :many
SELECT * FROM courts
WHERE deleted_at IS NULL
  AND (sqlc.narg('venue_id')::bigint IS NULL OR venue_id = sqlc.narg('venue_id'))
  AND (sqlc.narg('is_active')::bool IS NULL OR is_active = sqlc.narg('is_active'))
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountCourtsFiltered :one
SELECT count(*) FROM courts
WHERE deleted_at IS NULL
  AND (sqlc.narg('venue_id')::bigint IS NULL OR venue_id = sqlc.narg('venue_id'))
  AND (sqlc.narg('is_active')::bool IS NULL OR is_active = sqlc.narg('is_active'));

-- name: ListCourtsByTournament :many
-- Returns every court assigned to or referenced by a match in the given tournament,
-- ordered by sort_order then name. Soft-deleted courts are excluded.
SELECT DISTINCT c.* FROM courts c
LEFT JOIN matches m ON m.court_id = c.id AND m.tournament_id = @tournament_id
LEFT JOIN tournament_courts tc ON tc.court_id = c.id AND tc.tournament_id = @tournament_id
WHERE (m.tournament_id = @tournament_id OR tc.tournament_id = @tournament_id)
  AND c.deleted_at IS NULL
ORDER BY c.sort_order, c.name;
