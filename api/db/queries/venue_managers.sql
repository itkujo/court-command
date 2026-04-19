-- name: ListVenueManagers :many
SELECT vm.*, u.first_name, u.last_name, u.email, u.display_name, u.public_id
FROM venue_managers vm
JOIN users u ON u.id = vm.user_id
WHERE vm.venue_id = $1
ORDER BY vm.added_at ASC;

-- name: GetVenueManager :one
SELECT * FROM venue_managers
WHERE venue_id = $1 AND user_id = $2;

-- name: IsVenueManager :one
SELECT EXISTS(
    SELECT 1 FROM venue_managers
    WHERE venue_id = $1 AND user_id = $2
) AS is_manager;

-- name: IsVenueAdmin :one
SELECT EXISTS(
    SELECT 1 FROM venue_managers
    WHERE venue_id = $1 AND user_id = $2 AND role = 'admin'
) AS is_admin;

-- name: AddVenueManager :one
INSERT INTO venue_managers (venue_id, user_id, role, added_by)
VALUES ($1, $2, $3, $4)
ON CONFLICT (venue_id, user_id) DO UPDATE SET role = EXCLUDED.role
RETURNING *;

-- name: RemoveVenueManager :exec
DELETE FROM venue_managers
WHERE venue_id = $1 AND user_id = $2;

-- name: UpdateVenueManagerRole :one
UPDATE venue_managers
SET role = $3
WHERE venue_id = $1 AND user_id = $2
RETURNING *;

-- name: CountVenueManagers :one
SELECT COUNT(*) FROM venue_managers
WHERE venue_id = $1;

-- name: ListVenuesByManager :many
SELECT v.*
FROM venues v
JOIN venue_managers vm ON vm.venue_id = v.id
WHERE vm.user_id = $1 AND v.deleted_at IS NULL
ORDER BY v.name ASC;
