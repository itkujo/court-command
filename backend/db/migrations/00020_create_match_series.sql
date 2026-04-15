-- +goose Up

-- Match series: a best-of-N container for child matches
CREATE TABLE match_series (
    id                  BIGSERIAL PRIMARY KEY,
    public_id           TEXT NOT NULL DEFAULT ('ms_' || substr(md5(random()::text), 1, 12)),

    -- Context / ownership
    division_id         BIGINT REFERENCES divisions(id),
    pod_id              BIGINT REFERENCES pods(id),
    created_by_user_id  BIGINT NOT NULL REFERENCES users(id),

    -- Teams
    team1_id            BIGINT REFERENCES teams(id),
    team2_id            BIGINT REFERENCES teams(id),

    -- Configuration
    series_format       TEXT NOT NULL DEFAULT 'best_of_3'
                        CHECK (series_format IN ('best_of_3', 'best_of_5', 'best_of_7')),
    games_to_win        INT NOT NULL DEFAULT 2,

    -- Live score (wins per team across child matches)
    team1_wins          INT NOT NULL DEFAULT 0,
    team2_wins          INT NOT NULL DEFAULT 0,

    -- Status
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'forfeited')),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,

    -- Result
    winner_team_id      BIGINT REFERENCES teams(id),
    loser_team_id       BIGINT REFERENCES teams(id),
    win_reason          TEXT CHECK (win_reason IN ('score', 'forfeit', 'retirement', 'dq', 'bye')),

    -- Bracket wiring (series-level)
    round               INT,
    round_name          TEXT,
    match_number        INT,

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_match_series_public_id ON match_series(public_id);
CREATE INDEX idx_match_series_division_id ON match_series(division_id) WHERE division_id IS NOT NULL;
CREATE INDEX idx_match_series_pod_id ON match_series(pod_id) WHERE pod_id IS NOT NULL;
CREATE INDEX idx_match_series_status ON match_series(status);

-- Add FK from matches to match_series
ALTER TABLE matches ADD COLUMN match_series_id BIGINT REFERENCES match_series(id);
CREATE INDEX idx_matches_match_series_id ON matches(match_series_id) WHERE match_series_id IS NOT NULL;

-- +goose Down
ALTER TABLE matches DROP COLUMN IF EXISTS match_series_id;
DROP TABLE IF EXISTS match_series;
