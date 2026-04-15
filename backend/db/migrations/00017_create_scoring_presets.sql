-- +goose Up
CREATE TABLE scoring_presets (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    sport           TEXT NOT NULL DEFAULT 'pickleball',
    is_system       BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,

    -- Game/set structure
    games_per_set   INT NOT NULL DEFAULT 1,
    sets_to_win     INT NOT NULL DEFAULT 1,
    points_to_win   INT NOT NULL DEFAULT 11,
    win_by          INT NOT NULL DEFAULT 2,
    max_points      INT,                        -- hard cap (NULL = no cap)

    -- Rally scoring vs side-out
    rally_scoring   BOOLEAN NOT NULL DEFAULT false,

    -- Timeouts / freezes
    timeouts_per_game INT NOT NULL DEFAULT 0,
    timeout_duration_sec INT NOT NULL DEFAULT 60,
    freeze_at       INT,                        -- "freeze" / side-out timeout point

    created_by_user_id BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scoring_presets_active ON scoring_presets(is_active) WHERE is_active = true;
CREATE INDEX idx_scoring_presets_system ON scoring_presets(is_system) WHERE is_system = true;

-- Seed 10 system presets
INSERT INTO scoring_presets
    (name, description, sport, is_system, games_per_set, sets_to_win, points_to_win, win_by, max_points, rally_scoring, timeouts_per_game, timeout_duration_sec, freeze_at)
VALUES
    ('Standard 11 (side-out)',       'Traditional pickleball: 1 game to 11, win by 2, side-out scoring', 'pickleball', true, 1, 1, 11, 2, NULL, false, 0, 60, NULL),
    ('Standard 11 (rally)',          'Rally scoring: 1 game to 11, win by 2',                           'pickleball', true, 1, 1, 11, 2, NULL, true,  0, 60, NULL),
    ('Standard 15 (side-out)',       'Extended game to 15, win by 2, side-out scoring',                  'pickleball', true, 1, 1, 15, 2, NULL, false, 0, 60, NULL),
    ('Standard 15 (rally)',          'Rally scoring to 15, win by 2',                                    'pickleball', true, 1, 1, 15, 2, NULL, true,  0, 60, NULL),
    ('Standard 21 (side-out)',       'Long-form game to 21, win by 2, side-out scoring',                 'pickleball', true, 1, 1, 21, 2, NULL, false, 0, 60, NULL),
    ('Standard 21 (rally)',          'Rally scoring to 21, win by 2',                                    'pickleball', true, 1, 1, 21, 2, NULL, true,  0, 60, NULL),
    ('Best of 3 to 11 (side-out)',   'Best-of-3 games to 11, win by 2, side-out',                       'pickleball', true, 1, 2, 11, 2, NULL, false, 0, 60, NULL),
    ('Best of 3 to 11 (rally)',      'Best-of-3 games to 11, rally scoring',                            'pickleball', true, 1, 2, 11, 2, NULL, true,  0, 60, NULL),
    ('MLP Rally to 21',              'MLP-style rally scoring to 21 with freeze at 20',                 'pickleball', true, 1, 1, 21, 2, NULL, true,  2, 60, 20),
    ('Timed 10-min rally',           '10-minute rally game, highest score wins, cap at 21',             'pickleball', true, 1, 1, 21, 1, 21,  true,  1, 60, NULL);

-- +goose Down
DROP TABLE IF EXISTS scoring_presets;
