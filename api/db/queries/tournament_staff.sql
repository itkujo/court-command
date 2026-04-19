-- name: CreateTournamentStaffEntry :one
INSERT INTO tournament_staff (tournament_id, user_id, role, raw_password)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetTournamentStaff :many
SELECT ts.id, ts.tournament_id, ts.user_id, ts.role, ts.raw_password, ts.created_at,
       u.first_name, u.last_name, u.email, u.public_id
FROM tournament_staff ts
JOIN users u ON u.id = ts.user_id
WHERE ts.tournament_id = $1
ORDER BY ts.role ASC;

-- name: GetTournamentStaffByUserID :one
SELECT ts.id, ts.tournament_id, ts.user_id, ts.role, ts.raw_password, ts.created_at,
       t.name as tournament_name
FROM tournament_staff ts
JOIN tournaments t ON t.id = ts.tournament_id
WHERE ts.user_id = $1;

-- name: UpdateTournamentStaffPassword :one
UPDATE tournament_staff
SET raw_password = $1
WHERE tournament_id = $2 AND role = $3
RETURNING *;

-- name: DeleteTournamentStaffByTournamentAndRole :exec
DELETE FROM tournament_staff
WHERE tournament_id = $1 AND role = $2;
