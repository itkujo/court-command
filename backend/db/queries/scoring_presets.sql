-- name: GetScoringPreset :one
SELECT * FROM scoring_presets WHERE id = $1;

-- name: ListScoringPresetsActive :many
SELECT * FROM scoring_presets
WHERE is_active = true
ORDER BY is_system DESC, name ASC;

-- name: ListScoringPresetsAll :many
SELECT * FROM scoring_presets
ORDER BY is_system DESC, name ASC;

-- name: CreateScoringPreset :one
INSERT INTO scoring_presets (
    name, description, sport, is_system, is_active,
    games_per_set, sets_to_win, points_to_win, win_by, max_points,
    rally_scoring, timeouts_per_game, timeout_duration_sec, freeze_at,
    created_by_user_id
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10,
    $11, $12, $13, $14,
    $15
)
RETURNING *;

-- name: UpdateScoringPreset :one
UPDATE scoring_presets SET
    name = COALESCE(sqlc.narg('name'), name),
    description = COALESCE(sqlc.narg('description'), description),
    sport = COALESCE(sqlc.narg('sport'), sport),
    games_per_set = COALESCE(sqlc.narg('games_per_set'), games_per_set),
    sets_to_win = COALESCE(sqlc.narg('sets_to_win'), sets_to_win),
    points_to_win = COALESCE(sqlc.narg('points_to_win'), points_to_win),
    win_by = COALESCE(sqlc.narg('win_by'), win_by),
    max_points = COALESCE(sqlc.narg('max_points'), max_points),
    rally_scoring = COALESCE(sqlc.narg('rally_scoring'), rally_scoring),
    timeouts_per_game = COALESCE(sqlc.narg('timeouts_per_game'), timeouts_per_game),
    timeout_duration_sec = COALESCE(sqlc.narg('timeout_duration_sec'), timeout_duration_sec),
    freeze_at = COALESCE(sqlc.narg('freeze_at'), freeze_at),
    updated_at = now()
WHERE id = @preset_id
RETURNING *;

-- name: DeactivateScoringPreset :exec
UPDATE scoring_presets SET is_active = false, updated_at = now()
WHERE id = $1;

-- name: ActivateScoringPreset :exec
UPDATE scoring_presets SET is_active = true, updated_at = now()
WHERE id = $1;
