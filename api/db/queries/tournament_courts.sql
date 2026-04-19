-- name: AssignCourtToTournament :one
INSERT INTO tournament_courts (tournament_id, court_id, is_temporary)
VALUES ($1, $2, $3)
ON CONFLICT (tournament_id, court_id) DO UPDATE SET is_temporary = EXCLUDED.is_temporary
RETURNING *;

-- name: UnassignCourtFromTournament :exec
DELETE FROM tournament_courts
WHERE tournament_id = $1 AND court_id = $2;

-- name: ListTournamentCourts :many
SELECT tc.*, c.name AS court_name, c.surface_type, c.is_show_court,
       c.is_active, c.is_temporary AS court_is_temporary, c.sort_order,
       c.stream_url, c.stream_type, c.stream_is_live, c.stream_title,
       c.venue_id, c.notes
FROM tournament_courts tc
JOIN courts c ON c.id = tc.court_id AND c.deleted_at IS NULL
WHERE tc.tournament_id = $1
ORDER BY c.sort_order, c.name;

-- name: CleanupTournamentTempCourts :exec
-- Archives (soft-deletes) temporary courts created for a tournament
-- and removes the join table entries.
DELETE FROM tournament_courts
WHERE tournament_id = $1 AND is_temporary = true;
