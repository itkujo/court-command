-- name: CreateApiKey :one
INSERT INTO api_keys (user_id, name, key_hash, key_prefix, scopes, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetApiKeyByHash :one
SELECT * FROM api_keys
WHERE key_hash = $1 AND is_active = true;

-- name: GetApiKeyByID :one
SELECT * FROM api_keys WHERE id = $1;

-- name: ListApiKeysByUser :many
SELECT * FROM api_keys
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: UpdateApiKeyLastUsed :exec
UPDATE api_keys SET last_used_at = now()
WHERE id = $1;

-- name: DeactivateApiKey :exec
UPDATE api_keys SET is_active = false, updated_at = now()
WHERE id = $1 AND user_id = $2;

-- name: CountApiKeysByUser :one
SELECT count(*) FROM api_keys
WHERE user_id = $1 AND is_active = true;
