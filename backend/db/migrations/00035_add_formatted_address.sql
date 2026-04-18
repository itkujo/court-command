-- +goose Up

-- Add formatted_address to all entity tables with address support
ALTER TABLE venues ADD COLUMN IF NOT EXISTS formatted_address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS formatted_address TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS formatted_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS formatted_address TEXT;

-- Backfill: combine existing address fields into formatted_address
-- Venues have full street addresses
UPDATE venues SET formatted_address = TRIM(
  COALESCE(address_line_1, '') || ' ' ||
  COALESCE(address_line_2, '') || ', ' ||
  COALESCE(city, '') || ', ' ||
  COALESCE(state_province, '') || ' ' ||
  COALESCE(postal_code, '') || ', ' ||
  COALESCE(country, '')
)
WHERE formatted_address IS NULL
  AND (address_line_1 IS NOT NULL OR city IS NOT NULL);

-- Orgs typically just have city/state/country
UPDATE organizations SET formatted_address = TRIM(
  COALESCE(city, '') || ', ' ||
  COALESCE(state_province, '') || ', ' ||
  COALESCE(country, '')
)
WHERE formatted_address IS NULL
  AND city IS NOT NULL;

-- Leagues same as orgs
UPDATE leagues SET formatted_address = TRIM(
  COALESCE(city, '') || ', ' ||
  COALESCE(state_province, '') || ', ' ||
  COALESCE(country, '')
)
WHERE formatted_address IS NULL
  AND city IS NOT NULL;

-- Users/players
UPDATE users SET formatted_address = TRIM(
  COALESCE(city, '') || ', ' ||
  COALESCE(state_province, '') || ', ' ||
  COALESCE(country, '')
)
WHERE formatted_address IS NULL
  AND city IS NOT NULL;

-- +goose Down
ALTER TABLE venues DROP COLUMN IF EXISTS formatted_address;
ALTER TABLE organizations DROP COLUMN IF EXISTS formatted_address;
ALTER TABLE leagues DROP COLUMN IF EXISTS formatted_address;
ALTER TABLE users DROP COLUMN IF EXISTS formatted_address;
