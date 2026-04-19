-- api/db/queries/search.sql

-- name: SearchPlayersGlobal :many
SELECT id, public_id, first_name, last_name, display_name, city, state_province, is_profile_hidden
FROM users
WHERE deleted_at IS NULL
  AND status = 'active'
  AND is_profile_hidden = false
  AND (
    first_name ILIKE '%' || @query::TEXT || '%'
    OR last_name ILIKE '%' || @query::TEXT || '%'
    OR display_name ILIKE '%' || @query::TEXT || '%'
    OR public_id = @query::TEXT
  )
ORDER BY last_name, first_name
LIMIT $1;

-- name: SearchTeamsGlobal :many
SELECT id, name, short_name, slug, logo_url, primary_color, org_id
FROM teams
WHERE deleted_at IS NULL
  AND (
    name ILIKE '%' || @query::TEXT || '%'
    OR short_name ILIKE '%' || @query::TEXT || '%'
  )
ORDER BY name
LIMIT $1;

-- name: SearchOrganizationsGlobal :many
SELECT id, name, slug, logo_url, city, state_province, country
FROM organizations
WHERE deleted_at IS NULL
  AND (
    name ILIKE '%' || @query::TEXT || '%'
  )
ORDER BY name
LIMIT $1;

-- name: SearchTournamentsGlobal :many
SELECT id, public_id, name, slug, status, start_date, end_date, venue_id, logo_url
FROM tournaments
WHERE deleted_at IS NULL
  AND status NOT IN ('draft', 'cancelled')
  AND (
    name ILIKE '%' || @query::TEXT || '%'
  )
ORDER BY start_date DESC
LIMIT $1;

-- name: SearchLeaguesGlobal :many
SELECT id, public_id, name, slug, status, logo_url, city, state_province, country
FROM leagues
WHERE deleted_at IS NULL
  AND status NOT IN ('draft', 'cancelled')
  AND (
    name ILIKE '%' || @query::TEXT || '%'
  )
ORDER BY name
LIMIT $1;

-- name: SearchVenuesGlobal :many
SELECT id, name, slug, city, state_province, country, logo_url
FROM venues
WHERE deleted_at IS NULL
  AND status = 'published'
  AND (
    name ILIKE '%' || @query::TEXT || '%'
    OR city ILIKE '%' || @query::TEXT || '%'
  )
ORDER BY name
LIMIT $1;
