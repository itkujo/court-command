-- +goose Up
CREATE TABLE divisions (
    id                  BIGSERIAL PRIMARY KEY,
    tournament_id       BIGINT NOT NULL REFERENCES tournaments(id),
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL,
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
    check_in_open       BOOLEAN DEFAULT false,
    allow_self_check_in BOOLEAN DEFAULT false,
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                            'draft', 'registration_open', 'registration_closed',
                            'seeding', 'in_progress', 'completed'
                        )),
    seed_method         TEXT CHECK (seed_method IN ('manual', 'rating', 'random')),
    sort_order          INT DEFAULT 0,
    notes               TEXT,
    auto_approve        BOOLEAN DEFAULT true,
    registration_mode   TEXT DEFAULT 'open' CHECK (registration_mode IN ('open', 'invite_only')),
    auto_promote_waitlist BOOLEAN DEFAULT true,
    grand_finals_reset  BOOLEAN DEFAULT true,
    advancement_count   INT DEFAULT 2,
    current_phase       TEXT CHECK (current_phase IN ('pool', 'bracket')),
    report_to_dupr      BOOLEAN DEFAULT false,
    report_to_vair      BOOLEAN DEFAULT false,
    allow_ref_player_add BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    UNIQUE (tournament_id, slug)
);

CREATE INDEX idx_divisions_tournament ON divisions(tournament_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_divisions_status ON divisions(status) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS divisions;
