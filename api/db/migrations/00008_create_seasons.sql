-- +goose Up
CREATE TABLE seasons (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    league_id       BIGINT NOT NULL REFERENCES leagues(id),
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    start_date      DATE,
    end_date        DATE,
    description     TEXT,
    notes           TEXT,
    roster_confirmation_deadline TIMESTAMPTZ,
    standings_method TEXT DEFAULT 'placement_points'
                    CHECK (standings_method IN ('placement_points', 'win_loss', 'match_points', 'custom')),
    standings_config JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE (league_id, slug)
);

CREATE INDEX idx_seasons_league ON seasons(league_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_seasons_status ON seasons(status) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS seasons;
