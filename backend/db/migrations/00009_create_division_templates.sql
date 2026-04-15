-- +goose Up
CREATE TABLE division_templates (
    id                  BIGSERIAL PRIMARY KEY,
    league_id           BIGINT NOT NULL REFERENCES leagues(id),
    name                TEXT NOT NULL,
    format              TEXT NOT NULL CHECK (format IN ('singles', 'doubles', 'mixed_doubles', 'team_match')),
    gender_restriction  TEXT CHECK (gender_restriction IN ('open', 'mens', 'womens', 'mixed')),
    age_restriction     JSONB,
    skill_min           DOUBLE PRECISION,
    skill_max           DOUBLE PRECISION,
    rating_system       TEXT CHECK (rating_system IN ('dupr', 'vair', 'self_rated', 'none')),
    bracket_format      TEXT NOT NULL CHECK (bracket_format IN (
        'single_elimination', 'double_elimination', 'round_robin', 'pool_play', 'pool_to_bracket'
    )),
    scoring_format      TEXT,
    max_teams           INT,
    max_roster_size     INT,
    entry_fee_amount    NUMERIC(10, 2),
    entry_fee_currency  TEXT DEFAULT 'USD',
    seed_method         TEXT CHECK (seed_method IN ('manual', 'rating', 'random')),
    registration_mode   TEXT DEFAULT 'open' CHECK (registration_mode IN ('open', 'invite_only')),
    auto_approve        BOOLEAN DEFAULT true,
    auto_promote_waitlist BOOLEAN DEFAULT true,
    grand_finals_reset  BOOLEAN DEFAULT true,
    advancement_count   INT DEFAULT 2,
    allow_self_check_in BOOLEAN DEFAULT false,
    allow_ref_player_add BOOLEAN DEFAULT false,
    report_to_dupr      BOOLEAN DEFAULT false,
    report_to_vair      BOOLEAN DEFAULT false,
    sort_order          INT DEFAULT 0,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_division_templates_league ON division_templates(league_id) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS division_templates;
