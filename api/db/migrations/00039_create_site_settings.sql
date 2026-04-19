-- +goose Up
CREATE TABLE site_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_settings (key, value) VALUES
    ('ghost_url', ''),
    ('ghost_content_api_key', '');

-- +goose Down
DROP TABLE IF EXISTS site_settings;
