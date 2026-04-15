-- +goose Up
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS handedness TEXT CHECK (handedness IN ('right', 'left', 'ambidextrous'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_province TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paddle_brand TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paddle_model TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dupr_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vair_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS waiver_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_profile_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_dupr_id ON users(dupr_id) WHERE dupr_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_vair_id ON users(vair_id) WHERE vair_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_city_state ON users(city, state_province) WHERE deleted_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_users_city_state;
DROP INDEX IF EXISTS idx_users_vair_id;
DROP INDEX IF EXISTS idx_users_dupr_id;

ALTER TABLE users DROP COLUMN IF EXISTS is_profile_hidden;
ALTER TABLE users DROP COLUMN IF EXISTS waiver_accepted_at;
ALTER TABLE users DROP COLUMN IF EXISTS medical_notes;
ALTER TABLE users DROP COLUMN IF EXISTS emergency_contact_phone;
ALTER TABLE users DROP COLUMN IF EXISTS emergency_contact_name;
ALTER TABLE users DROP COLUMN IF EXISTS vair_id;
ALTER TABLE users DROP COLUMN IF EXISTS dupr_id;
ALTER TABLE users DROP COLUMN IF EXISTS paddle_model;
ALTER TABLE users DROP COLUMN IF EXISTS paddle_brand;
ALTER TABLE users DROP COLUMN IF EXISTS phone;
ALTER TABLE users DROP COLUMN IF EXISTS country;
ALTER TABLE users DROP COLUMN IF EXISTS state_province;
ALTER TABLE users DROP COLUMN IF EXISTS city;
ALTER TABLE users DROP COLUMN IF EXISTS bio;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE users DROP COLUMN IF EXISTS handedness;
ALTER TABLE users DROP COLUMN IF EXISTS gender;
