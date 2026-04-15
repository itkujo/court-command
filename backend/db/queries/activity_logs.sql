-- name: CreateActivityLog :one
INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListActivityLogs :many
SELECT * FROM activity_logs
WHERE (sqlc.narg('user_id')::BIGINT IS NULL OR user_id = sqlc.narg('user_id')::BIGINT)
  AND (sqlc.narg('action')::TEXT IS NULL OR action = sqlc.narg('action')::TEXT)
  AND (sqlc.narg('entity_type')::TEXT IS NULL OR entity_type = sqlc.narg('entity_type')::TEXT)
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountActivityLogs :one
SELECT count(*) FROM activity_logs
WHERE (sqlc.narg('user_id')::BIGINT IS NULL OR user_id = sqlc.narg('user_id')::BIGINT)
  AND (sqlc.narg('action')::TEXT IS NULL OR action = sqlc.narg('action')::TEXT)
  AND (sqlc.narg('entity_type')::TEXT IS NULL OR entity_type = sqlc.narg('entity_type')::TEXT);

-- name: GetActivityLogByID :one
SELECT * FROM activity_logs WHERE id = $1;
