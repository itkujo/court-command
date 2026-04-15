-- name: CreateSourceProfile :one
INSERT INTO source_profiles (
    name, created_by_user_id, source_type, api_url, webhook_secret,
    auth_type, auth_config, poll_interval_seconds, field_mapping
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING *;

-- name: GetSourceProfileByID :one
SELECT * FROM source_profiles WHERE id = $1;

-- name: ListSourceProfilesByUser :many
SELECT * FROM source_profiles
WHERE created_by_user_id = $1
ORDER BY created_at DESC;

-- name: ListActiveSourceProfiles :many
SELECT * FROM source_profiles
WHERE is_active = true
ORDER BY name;

-- name: UpdateSourceProfile :one
UPDATE source_profiles
SET name = $2,
    source_type = $3,
    api_url = $4,
    webhook_secret = $5,
    auth_type = $6,
    auth_config = $7,
    poll_interval_seconds = $8,
    field_mapping = $9,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateSourceProfilePollStatus :exec
UPDATE source_profiles
SET last_poll_at = now(),
    last_poll_status = $2,
    updated_at = now()
WHERE id = $1;

-- name: DeactivateSourceProfile :one
UPDATE source_profiles
SET is_active = false, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteSourceProfile :exec
DELETE FROM source_profiles WHERE id = $1;
