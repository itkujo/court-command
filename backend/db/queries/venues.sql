-- name: CreateVenue :one
INSERT INTO venues (
    name, slug, status, address_line_1, address_line_2, city, state_province,
    country, postal_code, latitude, longitude, timezone, website_url,
    contact_email, contact_phone, logo_url, photo_url, venue_map_url,
    description, surface_types, amenities, org_id, managed_by_user_id,
    bio, notes, created_by_user_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    $8, $9, $10, $11, $12, $13,
    $14, $15, $16, $17, $18,
    $19, $20, $21, $22, $23,
    $24, $25, $26
)
RETURNING *;

-- name: GetVenueByID :one
SELECT * FROM venues
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetVenueBySlug :one
SELECT * FROM venues
WHERE slug = $1 AND deleted_at IS NULL;

-- name: UpdateVenue :one
UPDATE venues SET
    name = COALESCE(sqlc.narg('name'), name),
    address_line_1 = COALESCE(sqlc.narg('address_line_1'), address_line_1),
    address_line_2 = COALESCE(sqlc.narg('address_line_2'), address_line_2),
    city = COALESCE(sqlc.narg('city'), city),
    state_province = COALESCE(sqlc.narg('state_province'), state_province),
    country = COALESCE(sqlc.narg('country'), country),
    postal_code = COALESCE(sqlc.narg('postal_code'), postal_code),
    latitude = COALESCE(sqlc.narg('latitude'), latitude),
    longitude = COALESCE(sqlc.narg('longitude'), longitude),
    timezone = COALESCE(sqlc.narg('timezone'), timezone),
    website_url = COALESCE(sqlc.narg('website_url'), website_url),
    contact_email = COALESCE(sqlc.narg('contact_email'), contact_email),
    contact_phone = COALESCE(sqlc.narg('contact_phone'), contact_phone),
    logo_url = COALESCE(sqlc.narg('logo_url'), logo_url),
    photo_url = COALESCE(sqlc.narg('photo_url'), photo_url),
    venue_map_url = COALESCE(sqlc.narg('venue_map_url'), venue_map_url),
    description = COALESCE(sqlc.narg('description'), description),
    surface_types = COALESCE(sqlc.narg('surface_types'), surface_types),
    amenities = COALESCE(sqlc.narg('amenities'), amenities),
    org_id = COALESCE(sqlc.narg('org_id'), org_id),
    managed_by_user_id = COALESCE(sqlc.narg('managed_by_user_id'), managed_by_user_id),
    bio = COALESCE(sqlc.narg('bio'), bio),
    notes = COALESCE(sqlc.narg('notes'), notes),
    updated_at = now()
WHERE id = @venue_id AND deleted_at IS NULL
RETURNING *;

-- name: UpdateVenueStatus :one
UPDATE venues SET
    status = $2,
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteVenue :exec
UPDATE venues SET
    deleted_at = now(),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListVenues :many
SELECT * FROM venues
WHERE deleted_at IS NULL
  AND (sqlc.narg('status')::TEXT IS NULL OR status = sqlc.narg('status')::TEXT)
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountVenues :one
SELECT count(*) FROM venues
WHERE deleted_at IS NULL
  AND (sqlc.narg('status')::TEXT IS NULL OR status = sqlc.narg('status')::TEXT);

-- name: SearchVenues :many
SELECT * FROM venues
WHERE deleted_at IS NULL
  AND (sqlc.narg('status')::TEXT IS NULL OR status = sqlc.narg('status')::TEXT)
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR description ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT)
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountSearchVenues :one
SELECT count(*) FROM venues
WHERE deleted_at IS NULL
  AND (sqlc.narg('status')::TEXT IS NULL OR status = sqlc.narg('status')::TEXT)
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR description ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT);

-- name: ListPendingVenues :many
SELECT * FROM venues
WHERE status = 'pending_review' AND deleted_at IS NULL
ORDER BY created_at ASC
LIMIT $1 OFFSET $2;

-- name: CountPendingVenues :one
SELECT count(*) FROM venues
WHERE status = 'pending_review' AND deleted_at IS NULL;

-- name: CheckVenueSlugExists :one
SELECT count(*) FROM venues
WHERE slug = $1 AND deleted_at IS NULL;

-- name: GetVenueCourtCount :one
SELECT count(*) FROM courts
WHERE venue_id = $1 AND deleted_at IS NULL;
