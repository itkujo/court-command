-- +goose Up

-- Add full address fields to organizations (currently only city, state_province, country)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address_line_1 TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address_line_2 TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add full address fields to leagues (currently only city, state_province, country)
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS address_line_1 TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS address_line_2 TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add full address fields to users/players (currently only city, state_province, country)
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line_1 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line_2 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- +goose Down
ALTER TABLE organizations DROP COLUMN IF EXISTS address_line_1;
ALTER TABLE organizations DROP COLUMN IF EXISTS address_line_2;
ALTER TABLE organizations DROP COLUMN IF EXISTS postal_code;
ALTER TABLE organizations DROP COLUMN IF EXISTS latitude;
ALTER TABLE organizations DROP COLUMN IF EXISTS longitude;

ALTER TABLE leagues DROP COLUMN IF EXISTS address_line_1;
ALTER TABLE leagues DROP COLUMN IF EXISTS address_line_2;
ALTER TABLE leagues DROP COLUMN IF EXISTS postal_code;
ALTER TABLE leagues DROP COLUMN IF EXISTS latitude;
ALTER TABLE leagues DROP COLUMN IF EXISTS longitude;

ALTER TABLE users DROP COLUMN IF EXISTS address_line_1;
ALTER TABLE users DROP COLUMN IF EXISTS address_line_2;
ALTER TABLE users DROP COLUMN IF EXISTS postal_code;
ALTER TABLE users DROP COLUMN IF EXISTS latitude;
ALTER TABLE users DROP COLUMN IF EXISTS longitude;
