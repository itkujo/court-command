-- name: CreateAnnouncement :one
INSERT INTO announcements (
    tournament_id, league_id, division_id, title, body,
    is_pinned, created_by_user_id
) VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetAnnouncementByID :one
SELECT * FROM announcements WHERE id = $1 AND deleted_at IS NULL;

-- name: ListAnnouncementsByTournament :many
-- When division_id is NULL the query returns all announcements for the
-- tournament (division-scoped and tournament-wide). When division_id is
-- non-NULL it returns only announcements targeting that division.
SELECT * FROM announcements
WHERE tournament_id = @tournament_id
  AND (sqlc.narg('division_id')::bigint IS NULL OR division_id = sqlc.narg('division_id')::bigint)
  AND deleted_at IS NULL
ORDER BY is_pinned DESC, created_at DESC
LIMIT @page_limit OFFSET @page_offset;

-- name: CountAnnouncementsByTournament :one
SELECT COUNT(*) FROM announcements
WHERE tournament_id = @tournament_id
  AND (sqlc.narg('division_id')::bigint IS NULL OR division_id = sqlc.narg('division_id')::bigint)
  AND deleted_at IS NULL;

-- name: CountAnnouncementsByDivision :one
SELECT COUNT(*) FROM announcements
WHERE division_id = $1 AND deleted_at IS NULL;

-- name: ListAnnouncementsByLeague :many
SELECT * FROM announcements
WHERE league_id = $1 AND deleted_at IS NULL
ORDER BY is_pinned DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountAnnouncementsByLeague :one
SELECT COUNT(*) FROM announcements
WHERE league_id = $1 AND deleted_at IS NULL;

-- name: ListAnnouncementsByDivision :many
SELECT * FROM announcements
WHERE division_id = $1 AND deleted_at IS NULL
ORDER BY is_pinned DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateAnnouncement :one
UPDATE announcements SET
    title = COALESCE(sqlc.narg('title'), title),
    body = COALESCE(sqlc.narg('body'), body),
    is_pinned = COALESCE(sqlc.narg('is_pinned'), is_pinned),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteAnnouncement :exec
UPDATE announcements SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;
