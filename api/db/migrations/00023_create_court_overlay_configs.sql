-- +goose Up
CREATE TABLE court_overlay_configs (
    id              BIGSERIAL PRIMARY KEY,
    court_id        BIGINT NOT NULL UNIQUE REFERENCES courts(id) ON DELETE CASCADE,
    theme_id        TEXT NOT NULL DEFAULT 'classic',
    color_overrides JSONB NOT NULL DEFAULT '{}',
    elements        JSONB NOT NULL DEFAULT '{
        "scoreboard": {"visible": true, "auto_animate": true},
        "lower_third": {"visible": false, "auto_animate": true},
        "player_card": {"visible": false, "auto_animate": true, "auto_dismiss_seconds": 10},
        "team_card": {"visible": false, "auto_animate": true, "auto_dismiss_seconds": 10},
        "sponsor_bug": {"visible": false, "auto_animate": true, "rotation_seconds": 15, "logos": []},
        "tournament_bug": {"visible": true, "auto_animate": true},
        "coming_up_next": {"visible": false, "auto_animate": true},
        "match_result": {"visible": false, "auto_animate": true, "auto_show_delay_seconds": 5, "auto_dismiss_seconds": 30},
        "custom_text": {"visible": false, "auto_animate": true, "text": "", "auto_dismiss_seconds": 0},
        "bracket_snapshot": {"visible": false, "auto_animate": true},
        "pool_standings": {"visible": false, "auto_animate": true},
        "series_score": {"visible": false, "auto_animate": true}
    }',
    source_profile_id BIGINT,
    overlay_token     TEXT,
    show_branding     BOOLEAN NOT NULL DEFAULT true,
    match_result_delay_seconds INT NOT NULL DEFAULT 30,
    idle_display      TEXT NOT NULL DEFAULT 'court_name'
                      CHECK (idle_display IN ('court_name', 'branding', 'none')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_court_overlay_configs_court ON court_overlay_configs (court_id);
CREATE INDEX idx_court_overlay_configs_token ON court_overlay_configs (overlay_token) WHERE overlay_token IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS court_overlay_configs;
