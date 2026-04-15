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
