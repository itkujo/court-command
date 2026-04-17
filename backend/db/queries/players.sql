-- backend/db/queries/players.sql

-- name: GetPlayerProfile :one
SELECT * FROM users
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetPlayerByPublicID :one
SELECT * FROM users
WHERE public_id = $1 AND deleted_at IS NULL;

-- name: UpdatePlayerProfile :one
UPDATE users SET
    display_name = COALESCE(sqlc.narg('display_name'), display_name),
    gender = COALESCE(sqlc.narg('gender'), gender),
    handedness = COALESCE(sqlc.narg('handedness'), handedness),
    avatar_url = COALESCE(sqlc.narg('avatar_url'), avatar_url),
    bio = COALESCE(sqlc.narg('bio'), bio),
    city = COALESCE(sqlc.narg('city'), city),
    state_province = COALESCE(sqlc.narg('state_province'), state_province),
    country = COALESCE(sqlc.narg('country'), country),
    postal_code = COALESCE(sqlc.narg('postal_code'), postal_code),
    address_line_1 = COALESCE(sqlc.narg('address_line_1'), address_line_1),
    address_line_2 = COALESCE(sqlc.narg('address_line_2'), address_line_2),
    latitude = COALESCE(sqlc.narg('latitude'), latitude),
    longitude = COALESCE(sqlc.narg('longitude'), longitude),
    phone = COALESCE(sqlc.narg('phone'), phone),
    paddle_brand = COALESCE(sqlc.narg('paddle_brand'), paddle_brand),
    paddle_model = COALESCE(sqlc.narg('paddle_model'), paddle_model),
    dupr_id = COALESCE(sqlc.narg('dupr_id'), dupr_id),
    vair_id = COALESCE(sqlc.narg('vair_id'), vair_id),
    emergency_contact_name = COALESCE(sqlc.narg('emergency_contact_name'), emergency_contact_name),
    emergency_contact_phone = COALESCE(sqlc.narg('emergency_contact_phone'), emergency_contact_phone),
    medical_notes = COALESCE(sqlc.narg('medical_notes'), medical_notes),
    is_profile_hidden = COALESCE(sqlc.narg('is_profile_hidden'), is_profile_hidden),
    updated_at = now()
WHERE id = @user_id AND deleted_at IS NULL
RETURNING *;

-- name: AcceptWaiver :one
UPDATE users SET
    waiver_accepted_at = now(),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: SearchPlayers :many
SELECT * FROM users
WHERE deleted_at IS NULL
  AND status != 'merged'
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR first_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR last_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR display_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR public_id = sqlc.narg('query')::TEXT
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT)
ORDER BY last_name, first_name
LIMIT $1 OFFSET $2;

-- name: CountSearchPlayers :one
SELECT count(*) FROM users
WHERE deleted_at IS NULL
  AND status != 'merged'
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR first_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR last_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR display_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR public_id = sqlc.narg('query')::TEXT
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT);

-- name: GetPlayerByDuprID :one
SELECT * FROM users
WHERE dupr_id = $1 AND deleted_at IS NULL;

-- name: GetPlayerByVairID :one
SELECT * FROM users
WHERE vair_id = $1 AND deleted_at IS NULL;
