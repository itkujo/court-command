-- name: CreateSeasonConfirmation :one
INSERT INTO season_confirmations (season_id, team_id, division_id, deadline)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetSeasonConfirmationByID :one
SELECT * FROM season_confirmations WHERE id = $1;

-- name: ListSeasonConfirmationsBySeason :many
SELECT * FROM season_confirmations
WHERE season_id = $1
ORDER BY deadline ASC;

-- name: ListSeasonConfirmationsByTeam :many
SELECT * FROM season_confirmations
WHERE team_id = $1
ORDER BY deadline ASC;

-- name: ConfirmSeasonParticipation :one
UPDATE season_confirmations SET
    confirmed = true,
    confirmed_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ListUnconfirmedBySeasonPastDeadline :many
SELECT * FROM season_confirmations
WHERE season_id = $1 AND confirmed = false AND deadline < NOW();
