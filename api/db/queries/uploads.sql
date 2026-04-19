-- name: CreateUpload :one
INSERT INTO uploads (user_id, filename, original_name, content_type, size_bytes, entity_type, entity_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetUploadByID :one
SELECT * FROM uploads WHERE id = $1;

-- name: ListUploadsByUser :many
SELECT * FROM uploads
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountUploadsByUser :one
SELECT count(*) FROM uploads
WHERE user_id = $1;

-- name: DeleteUpload :exec
DELETE FROM uploads WHERE id = $1 AND user_id = $2;

-- name: ListUploadsByEntity :many
SELECT * FROM uploads
WHERE entity_type = $1 AND entity_id = $2
ORDER BY created_at DESC;

-- name: ListOrphanedUploads :many
SELECT u.* FROM uploads u
WHERE u.created_at < $1
  AND NOT EXISTS (SELECT 1 FROM users p WHERE p.avatar_url = '/uploads/' || u.filename)
  AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.logo_url = '/uploads/' || u.filename)
  AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.logo_url = '/uploads/' || u.filename)
  AND NOT EXISTS (SELECT 1 FROM venues v WHERE v.logo_url = '/uploads/' || u.filename OR v.photo_url = '/uploads/' || u.filename OR v.venue_map_url = '/uploads/' || u.filename)
  AND NOT EXISTS (SELECT 1 FROM leagues l WHERE l.logo_url = '/uploads/' || u.filename OR l.banner_url = '/uploads/' || u.filename)
  AND NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.logo_url = '/uploads/' || u.filename OR t.banner_url = '/uploads/' || u.filename)
  AND NOT EXISTS (SELECT 1 FROM ad_configs a WHERE a.image_url = '/uploads/' || u.filename)
ORDER BY u.created_at ASC;

-- name: DeleteUploadByID :exec
DELETE FROM uploads WHERE id = $1;
