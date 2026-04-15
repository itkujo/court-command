-- name: BlockOrg :one
INSERT INTO org_blocks (player_id, org_id)
VALUES ($1, $2)
ON CONFLICT (player_id, org_id) DO NOTHING
RETURNING *;

-- name: UnblockOrg :exec
DELETE FROM org_blocks
WHERE player_id = $1 AND org_id = $2;

-- name: IsOrgBlocked :one
SELECT count(*) FROM org_blocks
WHERE player_id = $1 AND org_id = $2;

-- name: GetBlockedOrgs :many
SELECT ob.*, o.name, o.slug, o.logo_url
FROM org_blocks ob
JOIN organizations o ON o.id = ob.org_id
WHERE ob.player_id = $1 AND o.deleted_at IS NULL
ORDER BY ob.blocked_at DESC;
