-- +goose Up
ALTER TABLE ad_configs ADD COLUMN IF NOT EXISTS display_duration_sec INT NOT NULL DEFAULT 8;

-- +goose Down
ALTER TABLE ad_configs DROP COLUMN IF EXISTS display_duration_sec;
