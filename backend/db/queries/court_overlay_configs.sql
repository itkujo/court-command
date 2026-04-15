-- name: CreateOverlayConfig :one
INSERT INTO court_overlay_configs (
    court_id, theme_id, color_overrides, elements,
    source_profile_id, overlay_token, show_branding,
    match_result_delay_seconds, idle_display
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING *;

-- name: GetOverlayConfigByCourtID :one
SELECT * FROM court_overlay_configs WHERE court_id = $1;

-- name: GetOverlayConfigByToken :one
SELECT * FROM court_overlay_configs WHERE overlay_token = $1;

-- name: UpdateOverlayConfig :one
UPDATE court_overlay_configs
SET theme_id = $2,
    color_overrides = $3,
    elements = $4,
    source_profile_id = $5,
    show_branding = $6,
    match_result_delay_seconds = $7,
    idle_display = $8,
    updated_at = now()
WHERE court_id = $1
RETURNING *;

-- name: UpdateOverlayTheme :one
UPDATE court_overlay_configs
SET theme_id = $2,
    color_overrides = $3,
    updated_at = now()
WHERE court_id = $1
RETURNING *;

-- name: UpdateOverlayElements :one
UPDATE court_overlay_configs
SET elements = $2,
    updated_at = now()
WHERE court_id = $1
RETURNING *;

-- name: UpdateOverlayToken :one
UPDATE court_overlay_configs
SET overlay_token = $2,
    updated_at = now()
WHERE court_id = $1
RETURNING *;

-- name: UpdateOverlaySourceProfile :one
UPDATE court_overlay_configs
SET source_profile_id = $2,
    updated_at = now()
WHERE court_id = $1
RETURNING *;

-- name: DeleteOverlayConfig :exec
DELETE FROM court_overlay_configs WHERE court_id = $1;

-- name: OverlayConfigExists :one
SELECT EXISTS(SELECT 1 FROM court_overlay_configs WHERE court_id = $1) AS exists;
