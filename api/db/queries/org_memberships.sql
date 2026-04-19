-- name: AddMemberToOrg :one
INSERT INTO org_memberships (org_id, player_id, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: RemoveMemberFromOrg :exec
UPDATE org_memberships SET
    left_at = now(),
    status = 'inactive',
    updated_at = now()
WHERE org_id = $1 AND player_id = $2 AND left_at IS NULL;

-- name: UpdateMemberRole :one
UPDATE org_memberships SET
    role = $3,
    updated_at = now()
WHERE org_id = $1 AND player_id = $2 AND left_at IS NULL
RETURNING *;

-- name: GetOrgMembers :many
SELECT om.*, u.first_name, u.last_name, u.display_name, u.public_id, u.avatar_url, u.email
FROM org_memberships om
JOIN users u ON u.id = om.player_id
WHERE om.org_id = $1 AND om.left_at IS NULL AND u.deleted_at IS NULL
ORDER BY om.role DESC, u.last_name;

-- name: CheckMemberInOrg :one
SELECT count(*) FROM org_memberships
WHERE org_id = $1 AND player_id = $2 AND left_at IS NULL;

-- name: GetMemberRole :one
SELECT role FROM org_memberships
WHERE org_id = $1 AND player_id = $2 AND left_at IS NULL;

-- name: GetPlayerOrgs :many
SELECT o.*, om.role AS membership_role, om.joined_at AS membership_joined_at
FROM org_memberships om
JOIN organizations o ON o.id = om.org_id
WHERE om.player_id = $1 AND om.left_at IS NULL AND o.deleted_at IS NULL
ORDER BY o.name;
