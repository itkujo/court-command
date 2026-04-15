-- name: CreateLeagueRegistration :one
INSERT INTO league_registrations (league_id, org_id, status, notes)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetLeagueRegistrationByID :one
SELECT * FROM league_registrations WHERE id = $1;

-- name: GetLeagueRegistrationByLeagueAndOrg :one
SELECT * FROM league_registrations
WHERE league_id = $1 AND org_id = $2;

-- name: ListLeagueRegistrationsByLeague :many
SELECT * FROM league_registrations
WHERE league_id = $1
ORDER BY registered_at DESC
LIMIT $2 OFFSET $3;

-- name: CountLeagueRegistrationsByLeague :one
SELECT COUNT(*) FROM league_registrations WHERE league_id = $1;

-- name: ListLeagueRegistrationsByOrg :many
SELECT * FROM league_registrations
WHERE org_id = $1
ORDER BY registered_at DESC;

-- name: UpdateLeagueRegistrationStatus :one
UPDATE league_registrations SET
    status = $2,
    approved_at = CASE WHEN $2 = 'active' AND approved_at IS NULL THEN NOW() ELSE approved_at END
WHERE id = $1
RETURNING *;

-- name: UpdateLeagueRegistrationNotes :one
UPDATE league_registrations SET notes = $2
WHERE id = $1
RETURNING *;
