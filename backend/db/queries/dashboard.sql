-- backend/db/queries/dashboard.sql

-- name: GetUpcomingMatchesForPlayer :many
SELECT m.* FROM matches m
JOIN team_rosters tr ON (tr.team_id = m.team1_id OR tr.team_id = m.team2_id)
WHERE tr.player_id = $1
  AND tr.status = 'active'
  AND tr.left_at IS NULL
  AND m.status IN ('scheduled', 'in_progress')
ORDER BY m.scheduled_at NULLS LAST, m.created_at
LIMIT $2;

-- name: GetActiveRegistrationsForPlayer :many
SELECT r.*, d.name as division_name, d.tournament_id, t.name as tournament_name, t.status as tournament_status
FROM registrations r
JOIN divisions d ON d.id = r.division_id
JOIN tournaments t ON t.id = d.tournament_id
WHERE (r.player_id = $1 OR r.team_id IN (
    SELECT tr.team_id FROM team_rosters tr
    WHERE tr.player_id = $1 AND tr.status = 'active' AND tr.left_at IS NULL
))
AND r.status IN ('approved', 'checked_in')
AND t.status NOT IN ('completed', 'archived', 'cancelled')
AND t.deleted_at IS NULL
AND d.deleted_at IS NULL
ORDER BY t.start_date;

-- name: GetRecentMatchResultsForPlayer :many
SELECT m.* FROM matches m
JOIN team_rosters tr ON (tr.team_id = m.team1_id OR tr.team_id = m.team2_id)
WHERE tr.player_id = $1
  AND tr.status = 'active'
  AND m.status IN ('completed', 'forfeited')
  AND m.match_type != 'quick'
ORDER BY m.completed_at DESC NULLS LAST
LIMIT $2;

-- name: GetPlayerStatsAggregate :one
SELECT
    COUNT(*) FILTER (WHERE m.status IN ('completed', 'forfeited')) as matches_played,
    COUNT(*) FILTER (WHERE m.winner_team_id = tr.team_id AND m.status = 'completed') as matches_won,
    COUNT(*) FILTER (WHERE m.loser_team_id = tr.team_id AND m.status = 'completed') as matches_lost
FROM matches m
JOIN team_rosters tr ON (tr.team_id = m.team1_id OR tr.team_id = m.team2_id)
WHERE tr.player_id = $1
  AND tr.status = 'active'
  AND m.match_type != 'quick'
  AND m.status IN ('completed', 'forfeited');

-- name: GetAnnouncementsForPlayer :many
SELECT a.* FROM announcements a
WHERE a.deleted_at IS NULL
AND (
  a.tournament_id IN (
      SELECT DISTINCT d.tournament_id FROM registrations r
      JOIN divisions d ON d.id = r.division_id
      WHERE (r.player_id = $1 OR r.team_id IN (
          SELECT tr.team_id FROM team_rosters tr
          WHERE tr.player_id = $1 AND tr.status = 'active' AND tr.left_at IS NULL
      ))
      AND r.status IN ('approved', 'checked_in')
  )
  OR a.league_id IN (
      SELECT DISTINCT t.league_id FROM registrations r
      JOIN divisions d ON d.id = r.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE t.league_id IS NOT NULL
      AND (r.player_id = $1 OR r.team_id IN (
          SELECT tr.team_id FROM team_rosters tr
          WHERE tr.player_id = $1 AND tr.status = 'active' AND tr.left_at IS NULL
      ))
      AND r.status IN ('approved', 'checked_in')
  )
)
ORDER BY a.is_pinned DESC, a.created_at DESC
LIMIT $2;

-- name: GetDashboardPlayerTeams :many
SELECT t.*, tr.role as roster_role, tr.jersey_number
FROM teams t
JOIN team_rosters tr ON tr.team_id = t.id
WHERE tr.player_id = $1
  AND tr.status = 'active'
  AND tr.left_at IS NULL
  AND t.deleted_at IS NULL
ORDER BY t.name;
