-- +goose Up
ALTER TABLE court_overlay_configs
    ADD COLUMN data_overrides JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN court_overlay_configs.data_overrides IS
    'Per-court field-level overrides for overlay data. Keys match canonical OverlayData fields (e.g. team_1_name, division_name). Values replace resolved data before rendering.';

-- +goose Down
ALTER TABLE court_overlay_configs DROP COLUMN IF EXISTS data_overrides;
