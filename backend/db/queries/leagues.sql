-- name: CreateLeague :one
INSERT INTO leagues (
    name, slug, status, logo_url, banner_url, description, website_url,
    contact_email, contact_phone, city, state_province, country,
    postal_code, address_line_1, address_line_2, formatted_address, latitude, longitude,
    rules_document_url, social_links, sponsor_info, notes, created_by_user_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
) RETURNING *;

-- name: GetLeagueByID :one
SELECT * FROM leagues WHERE id = $1 AND deleted_at IS NULL;

-- name: GetLeagueBySlug :one
SELECT * FROM leagues WHERE slug = $1 AND deleted_at IS NULL;

-- name: GetLeagueByPublicID :one
SELECT * FROM leagues WHERE public_id = $1 AND deleted_at IS NULL;

-- name: ListLeagues :many
SELECT * FROM leagues
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountLeagues :one
SELECT COUNT(*) FROM leagues WHERE deleted_at IS NULL;

-- name: SearchLeagues :many
SELECT * FROM leagues
WHERE deleted_at IS NULL
  AND (
    name ILIKE '%' || @search_term::TEXT || '%'
    OR city ILIKE '%' || @search_term::TEXT || '%'
    OR state_province ILIKE '%' || @search_term::TEXT || '%'
    OR country ILIKE '%' || @search_term::TEXT || '%'
  )
ORDER BY name ASC
LIMIT $1 OFFSET $2;

-- name: CountSearchLeagues :one
SELECT COUNT(*) FROM leagues
WHERE deleted_at IS NULL
  AND (
    name ILIKE '%' || @search_term::TEXT || '%'
    OR city ILIKE '%' || @search_term::TEXT || '%'
    OR state_province ILIKE '%' || @search_term::TEXT || '%'
    OR country ILIKE '%' || @search_term::TEXT || '%'
  );

-- name: UpdateLeague :one
UPDATE leagues SET
    name = COALESCE(sqlc.narg('name'), name),
    slug = COALESCE(sqlc.narg('slug'), slug),
    status = COALESCE(sqlc.narg('status'), status),
    logo_url = COALESCE(sqlc.narg('logo_url'), logo_url),
    banner_url = COALESCE(sqlc.narg('banner_url'), banner_url),
    description = COALESCE(sqlc.narg('description'), description),
    website_url = COALESCE(sqlc.narg('website_url'), website_url),
    contact_email = COALESCE(sqlc.narg('contact_email'), contact_email),
    contact_phone = COALESCE(sqlc.narg('contact_phone'), contact_phone),
    city = COALESCE(sqlc.narg('city'), city),
    state_province = COALESCE(sqlc.narg('state_province'), state_province),
    country = COALESCE(sqlc.narg('country'), country),
    postal_code = COALESCE(sqlc.narg('postal_code'), postal_code),
    address_line_1 = COALESCE(sqlc.narg('address_line_1'), address_line_1),
    address_line_2 = COALESCE(sqlc.narg('address_line_2'), address_line_2),
    formatted_address = COALESCE(sqlc.narg('formatted_address'), formatted_address),
    latitude = COALESCE(sqlc.narg('latitude'), latitude),
    longitude = COALESCE(sqlc.narg('longitude'), longitude),
    rules_document_url = COALESCE(sqlc.narg('rules_document_url'), rules_document_url),
    social_links = COALESCE(sqlc.narg('social_links'), social_links),
    sponsor_info = COALESCE(sqlc.narg('sponsor_info'), sponsor_info),
    notes = COALESCE(sqlc.narg('notes'), notes),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteLeague :exec
UPDATE leagues SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListLeaguesByCreator :many
SELECT * FROM leagues
WHERE created_by_user_id = $1 AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountLeaguesByCreator :one
SELECT COUNT(*) FROM leagues
WHERE created_by_user_id = $1 AND deleted_at IS NULL;

-- name: SlugExistsLeague :one
SELECT EXISTS(SELECT 1 FROM leagues WHERE slug = $1 AND deleted_at IS NULL);
