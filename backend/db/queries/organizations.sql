-- name: CreateOrganization :one
INSERT INTO organizations (name, slug, logo_url, primary_color, secondary_color, website_url, contact_email, contact_phone, city, state_province, country, bio, founded_year, social_links, created_by_user_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
RETURNING *;

-- name: GetOrgByID :one
SELECT * FROM organizations
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetOrgBySlug :one
SELECT * FROM organizations
WHERE slug = $1 AND deleted_at IS NULL;

-- name: UpdateOrg :one
UPDATE organizations SET
    name = COALESCE(sqlc.narg('name'), name),
    logo_url = COALESCE(sqlc.narg('logo_url'), logo_url),
    primary_color = COALESCE(sqlc.narg('primary_color'), primary_color),
    secondary_color = COALESCE(sqlc.narg('secondary_color'), secondary_color),
    website_url = COALESCE(sqlc.narg('website_url'), website_url),
    contact_email = COALESCE(sqlc.narg('contact_email'), contact_email),
    contact_phone = COALESCE(sqlc.narg('contact_phone'), contact_phone),
    city = COALESCE(sqlc.narg('city'), city),
    state_province = COALESCE(sqlc.narg('state_province'), state_province),
    country = COALESCE(sqlc.narg('country'), country),
    bio = COALESCE(sqlc.narg('bio'), bio),
    founded_year = COALESCE(sqlc.narg('founded_year'), founded_year),
    social_links = COALESCE(sqlc.narg('social_links'), social_links),
    updated_at = now()
WHERE id = @org_id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteOrg :exec
UPDATE organizations SET
    deleted_at = now(),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListOrgs :many
SELECT * FROM organizations
WHERE deleted_at IS NULL
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountOrgs :one
SELECT count(*) FROM organizations
WHERE deleted_at IS NULL;

-- name: SearchOrgs :many
SELECT * FROM organizations
WHERE deleted_at IS NULL
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT)
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountSearchOrgs :one
SELECT count(*) FROM organizations
WHERE deleted_at IS NULL
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT);

-- name: CheckOrgSlugExists :one
SELECT count(*) FROM organizations
WHERE slug = $1 AND deleted_at IS NULL;

-- name: ListOrgsByUser :many
SELECT o.*, om.role AS membership_role
FROM organizations o
JOIN org_memberships om ON om.org_id = o.id
WHERE om.player_id = $1 AND om.left_at IS NULL AND o.deleted_at IS NULL
ORDER BY o.name;
