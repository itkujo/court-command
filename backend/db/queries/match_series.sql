-- name: CreateMatchSeries :one
INSERT INTO match_series (
    division_id, pod_id, created_by_user_id,
    team1_id, team2_id,
    series_format, games_to_win,
    status,
    round, round_name, match_number
) VALUES (
    $1, $2, $3,
    $4, $5,
    $6, $7,
    $8,
    $9, $10, $11
)
RETURNING *;

-- name: GetMatchSeries :one
SELECT * FROM match_series WHERE id = $1;

-- name: GetMatchSeriesByPublicID :one
SELECT * FROM match_series WHERE public_id = $1;

-- name: GetMatchSeriesForUpdate :one
SELECT * FROM match_series WHERE id = $1 FOR UPDATE;

-- name: ListMatchSeriesByDivision :many
SELECT * FROM match_series
WHERE division_id = $1
ORDER BY round, match_number, created_at
LIMIT $2 OFFSET $3;

-- name: CountMatchSeriesByDivision :one
SELECT count(*) FROM match_series WHERE division_id = $1;

-- name: ListMatchSeriesByPod :many
SELECT * FROM match_series
WHERE pod_id = $1
ORDER BY round, match_number, created_at
LIMIT $2 OFFSET $3;

-- name: UpdateMatchSeriesStatus :one
UPDATE match_series SET
    status = $2,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchSeriesStarted :one
UPDATE match_series SET
    status = 'in_progress',
    started_at = now(),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchSeriesScore :one
UPDATE match_series SET
    team1_wins = $2,
    team2_wins = $3,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchSeriesResult :one
UPDATE match_series SET
    status = 'completed',
    winner_team_id = $2,
    loser_team_id = $3,
    win_reason = $4,
    completed_at = now(),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchSeriesForfeited :one
UPDATE match_series SET
    status = 'forfeited',
    winner_team_id = $2,
    loser_team_id = $3,
    win_reason = 'forfeit',
    completed_at = now(),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListMatchesBySeriesID :many
SELECT * FROM matches
WHERE match_series_id = $1
ORDER BY match_number, created_at;

-- name: CountMatchesBySeriesID :one
SELECT count(*) FROM matches WHERE match_series_id = $1;
