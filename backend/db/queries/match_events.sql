-- name: CreateMatchEvent :one
INSERT INTO match_events (
    match_id, sequence_id, event_type,
    team1_score, team2_score, current_set, current_game,
    serving_team, server_number, set_scores,
    payload, created_by_user_id
) VALUES (
    $1, $2, $3,
    $4, $5, $6, $7,
    $8, $9, $10,
    $11, $12
)
RETURNING *;

-- name: GetLatestMatchEvent :one
SELECT * FROM match_events
WHERE match_id = $1
ORDER BY sequence_id DESC
LIMIT 1;

-- name: GetMatchEventBySequence :one
SELECT * FROM match_events
WHERE match_id = $1 AND sequence_id = $2;

-- name: GetPreviousMatchEvent :one
SELECT * FROM match_events
WHERE match_id = $1 AND sequence_id < $2
ORDER BY sequence_id DESC
LIMIT 1;

-- name: ListMatchEvents :many
SELECT * FROM match_events
WHERE match_id = $1
ORDER BY sequence_id ASC;

-- name: ListMatchEventsByType :many
SELECT * FROM match_events
WHERE match_id = $1 AND event_type = $2
ORDER BY sequence_id ASC;

-- name: CountMatchEvents :one
SELECT count(*) FROM match_events WHERE match_id = $1;

-- name: GetNextSequenceID :one
SELECT COALESCE(MAX(sequence_id), 0) + 1 AS next_seq
FROM match_events
WHERE match_id = $1;

-- name: DeleteMatchEventsAfterSequence :exec
DELETE FROM match_events
WHERE match_id = $1 AND sequence_id > $2;

-- name: DeleteAllMatchEvents :exec
DELETE FROM match_events WHERE match_id = $1;
