-- name: AddPlayerToTeam :one
INSERT INTO team_rosters (team_id, player_id, role, jersey_number)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: RemovePlayerFromTeam :exec
UPDATE team_rosters SET
    left_at = now(),
    status = 'inactive',
    updated_at = now()
WHERE team_id = $1 AND player_id = $2 AND left_at IS NULL;

-- name: UpdateRosterEntry :one
UPDATE team_rosters SET
    role = COALESCE(sqlc.narg('role'), role),
    jersey_number = COALESCE(sqlc.narg('jersey_number'), jersey_number),
    status = COALESCE(sqlc.narg('status'), status),
    updated_at = now()
WHERE team_id = @team_id AND player_id = @player_id AND left_at IS NULL
RETURNING *;

-- name: GetActiveRoster :many
SELECT tr.*, u.first_name, u.last_name, u.display_name, u.public_id, u.avatar_url
FROM team_rosters tr
JOIN users u ON u.id = tr.player_id
WHERE tr.team_id = $1 AND tr.left_at IS NULL AND u.deleted_at IS NULL
ORDER BY tr.role, u.last_name;

-- name: GetPlayerTeams :many
SELECT t.*, tr.role AS roster_role, tr.jersey_number, tr.joined_at AS roster_joined_at, tr.status AS roster_status
FROM team_rosters tr
JOIN teams t ON t.id = tr.team_id
WHERE tr.player_id = $1 AND tr.left_at IS NULL AND t.deleted_at IS NULL
ORDER BY t.name;

-- name: CheckPlayerOnTeam :one
SELECT count(*) FROM team_rosters
WHERE team_id = $1 AND player_id = $2 AND left_at IS NULL;

-- name: DeactivatePlayerRostersForOrg :exec
UPDATE team_rosters SET
    left_at = now(),
    status = 'inactive',
    updated_at = now()
WHERE player_id = $1
  AND left_at IS NULL
  AND team_id IN (
    SELECT id FROM teams WHERE org_id = $2 AND deleted_at IS NULL
  );

-- name: CountActiveRoster :one
SELECT count(*) FROM team_rosters
WHERE team_id = $1 AND left_at IS NULL;
