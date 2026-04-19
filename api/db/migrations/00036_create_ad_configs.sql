-- +goose Up
CREATE TABLE ad_configs (
    id BIGSERIAL PRIMARY KEY,
    slot_name TEXT NOT NULL,
    ad_type TEXT NOT NULL CHECK (ad_type IN ('image', 'embed')),
    -- For image ads
    image_url TEXT,
    link_url TEXT,
    alt_text TEXT,
    -- For embed ads (Google AdSense, etc.)
    embed_code TEXT,
    -- Scheduling
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    -- Targeting
    sizes TEXT[] NOT NULL DEFAULT '{}',
    -- Metadata
    name TEXT NOT NULL DEFAULT '',
    created_by_user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_configs_active ON ad_configs (is_active, sort_order) WHERE is_active = true;
CREATE INDEX idx_ad_configs_slot ON ad_configs (slot_name) WHERE is_active = true;

-- +goose Down
DROP TABLE IF EXISTS ad_configs;
