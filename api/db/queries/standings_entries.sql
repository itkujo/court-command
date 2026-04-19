-- name: UpsertStandingsEntry :one
INSERT INTO standings_entries (
    season_id, division_id, team_id,
    wins, losses, draws,
    points_for, points_against, point_differential,
    matches_played, standing_points, rank,
    updated_at
) VALUES (
    $1, $2, $3,
    $4, $5, $6,
    $7, $8, $9,
    $10, $11, $12,
    NOW()
)
ON CONFLICT (season_id, division_id, team_id)
DO UPDATE SET
    wins              = EXCLUDED.wins,
    losses            = EXCLUDED.losses,
    draws             = EXCLUDED.draws,
    points_for        = EXCLUDED.points_for,
    points_against    = EXCLUDED.points_against,
    point_differential= EXCLUDED.point_differential,
    matches_played    = EXCLUDED.matches_played,
    standing_points   = EXCLUDED.standing_points,
    rank              = EXCLUDED.rank,
    updated_at        = NOW()
RETURNING *;

-- name: GetStandingsEntry :one
SELECT * FROM standings_entries
WHERE season_id = $1 AND division_id = $2 AND team_id = $3;

-- name: ListStandingsByDivision :many
SELECT * FROM standings_entries
WHERE season_id = $1 AND division_id = $2
ORDER BY rank ASC
LIMIT $3 OFFSET $4;

-- name: CountStandingsByDivision :one
SELECT COUNT(*) FROM standings_entries
WHERE season_id = $1 AND division_id = $2;

-- name: UpdateStandingsOverride :one
UPDATE standings_entries SET
    override_points = $4,
    override_reason = $5,
    updated_at      = NOW()
WHERE season_id = $1 AND division_id = $2 AND team_id = $3
RETURNING *;

-- name: ClearStandingsOverride :one
UPDATE standings_entries SET
    override_points = NULL,
    override_reason = NULL,
    updated_at      = NOW()
WHERE season_id = $1 AND division_id = $2 AND team_id = $3
RETURNING *;

-- name: MarkTeamWithdrawn :one
UPDATE standings_entries SET
    is_withdrawn = TRUE,
    withdrawn_at = NOW(),
    updated_at   = NOW()
WHERE season_id = $1 AND division_id = $2 AND team_id = $3
RETURNING *;

-- name: DeleteStandingsByDivision :exec
DELETE FROM standings_entries
WHERE season_id = $1 AND division_id = $2;

-- name: ListStandingsBySeason :many
SELECT * FROM standings_entries
WHERE season_id = $1
ORDER BY division_id, rank ASC;
