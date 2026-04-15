-- +goose Up
CREATE TABLE source_profiles (
    id                    BIGSERIAL PRIMARY KEY,
    name                  TEXT NOT NULL,
    created_by_user_id    BIGINT NOT NULL REFERENCES users(id),
    source_type           TEXT NOT NULL DEFAULT 'court_command'
                          CHECK (source_type IN ('court_command', 'rest_api', 'webhook')),
    api_url               TEXT,
    webhook_secret        TEXT,
    auth_type             TEXT NOT NULL DEFAULT 'none'
                          CHECK (auth_type IN ('none', 'api_key', 'bearer', 'basic')),
    auth_config           JSONB NOT NULL DEFAULT '{}',
    poll_interval_seconds INT DEFAULT 5,
    field_mapping         JSONB NOT NULL DEFAULT '{}',
    is_active             BOOLEAN NOT NULL DEFAULT true,
    last_poll_at          TIMESTAMPTZ,
    last_poll_status      TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_source_profiles_user ON source_profiles (created_by_user_id);
CREATE INDEX idx_source_profiles_active ON source_profiles (is_active) WHERE is_active = true;

-- Add FK from court_overlay_configs to source_profiles
ALTER TABLE court_overlay_configs ADD CONSTRAINT fk_overlay_source_profile
    FOREIGN KEY (source_profile_id) REFERENCES source_profiles(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE court_overlay_configs DROP CONSTRAINT IF EXISTS fk_overlay_source_profile;
DROP TABLE IF EXISTS source_profiles;
