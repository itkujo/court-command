-- name: ListActiveAds :many
SELECT * FROM ad_configs
WHERE is_active = true
ORDER BY sort_order ASC, created_at DESC;

-- name: ListAllAds :many
SELECT * FROM ad_configs
ORDER BY sort_order ASC, created_at DESC;

-- name: GetAdByID :one
SELECT * FROM ad_configs WHERE id = $1;

-- name: CreateAd :one
INSERT INTO ad_configs (
    slot_name, ad_type, image_url, link_url, alt_text,
    embed_code, is_active, sort_order, sizes, name, created_by_user_id, display_duration_sec
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
) RETURNING *;

-- name: UpdateAd :one
UPDATE ad_configs SET
    slot_name = COALESCE(sqlc.narg('slot_name'), slot_name),
    ad_type = COALESCE(sqlc.narg('ad_type'), ad_type),
    image_url = COALESCE(sqlc.narg('image_url'), image_url),
    link_url = COALESCE(sqlc.narg('link_url'), link_url),
    alt_text = COALESCE(sqlc.narg('alt_text'), alt_text),
    embed_code = COALESCE(sqlc.narg('embed_code'), embed_code),
    is_active = COALESCE(sqlc.narg('is_active'), is_active),
    sort_order = COALESCE(sqlc.narg('sort_order'), sort_order),
    sizes = COALESCE(sqlc.narg('sizes'), sizes),
    name = COALESCE(sqlc.narg('name'), name),
    display_duration_sec = COALESCE(sqlc.narg('display_duration_sec'), display_duration_sec),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteAd :exec
DELETE FROM ad_configs WHERE id = $1;

-- name: CountAds :one
SELECT COUNT(*) FROM ad_configs;
