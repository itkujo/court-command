-- +goose Up
CREATE TABLE standings_entries (
    id                BIGSERIAL PRIMARY KEY,
    season_id         BIGINT NOT NULL REFERENCES seasons(id),
    division_id       BIGINT NOT NULL REFERENCES divisions(id),
    team_id           BIGINT NOT NULL REFERENCES teams(id),

    -- computed stats
    wins              INT NOT NULL DEFAULT 0,
    losses            INT NOT NULL DEFAULT 0,
    draws             INT NOT NULL DEFAULT 0,
    points_for        INT NOT NULL DEFAULT 0,
    points_against    INT NOT NULL DEFAULT 0,
    point_differential INT NOT NULL DEFAULT 0,
    matches_played    INT NOT NULL DEFAULT 0,
    standing_points   INT NOT NULL DEFAULT 0,

    -- admin override
    override_points   INT,
    override_reason   TEXT,

    -- withdrawal tracking
    is_withdrawn      BOOLEAN NOT NULL DEFAULT FALSE,
    withdrawn_at      TIMESTAMPTZ,

    rank              INT NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (season_id, division_id, team_id)
);

CREATE INDEX idx_standings_season_division
    ON standings_entries(season_id, division_id);
CREATE INDEX idx_standings_rank
    ON standings_entries(season_id, division_id, rank);

-- +goose Down
DROP TABLE IF EXISTS standings_entries;
