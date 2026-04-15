-- +goose Up
CREATE TABLE matches (
    id                  BIGSERIAL PRIMARY KEY,
    public_id           TEXT NOT NULL DEFAULT ('m_' || substr(md5(random()::text), 1, 12)),

    -- Context / ownership
    tournament_id       BIGINT REFERENCES tournaments(id),
    division_id         BIGINT REFERENCES divisions(id),
    pod_id              BIGINT REFERENCES pods(id),
    court_id            BIGINT REFERENCES courts(id),
    created_by_user_id  BIGINT NOT NULL REFERENCES users(id),

    -- Match type
    match_type          TEXT NOT NULL DEFAULT 'tournament'
                        CHECK (match_type IN ('tournament','quick','pickup','practice','league')),
    round               INT,
    round_name          TEXT,
    match_number        INT,

    -- Teams
    team1_id            BIGINT REFERENCES teams(id),
    team2_id            BIGINT REFERENCES teams(id),
    team1_seed          INT,
    team2_seed          INT,

    -- Scoring configuration (snapshot from preset at match creation)
    scoring_preset_id   BIGINT REFERENCES scoring_presets(id),
    games_per_set       INT NOT NULL DEFAULT 1,
    sets_to_win         INT NOT NULL DEFAULT 1,
    points_to_win       INT NOT NULL DEFAULT 11,
    win_by              INT NOT NULL DEFAULT 2,
    max_points          INT,
    rally_scoring       BOOLEAN NOT NULL DEFAULT false,
    timeouts_per_game   INT NOT NULL DEFAULT 0,
    timeout_duration_sec INT NOT NULL DEFAULT 60,
    freeze_at           INT,

    -- Live score (denormalized from events for fast reads)
    team1_score         INT NOT NULL DEFAULT 0,
    team2_score         INT NOT NULL DEFAULT 0,
    current_set         INT NOT NULL DEFAULT 1,
    current_game        INT NOT NULL DEFAULT 1,
    serving_team        INT CHECK (serving_team IN (1, 2)),
    server_number       INT CHECK (server_number IN (1, 2)),

    -- Set scores (JSONB array of {team1: X, team2: Y} per set)
    set_scores          JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Status
    status              TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN (
                            'scheduled', 'warmup', 'in_progress',
                            'paused', 'completed', 'cancelled', 'forfeited'
                        )),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,

    -- Result
    winner_team_id      BIGINT REFERENCES teams(id),
    loser_team_id       BIGINT REFERENCES teams(id),
    win_reason          TEXT CHECK (win_reason IN ('score','forfeit','retirement','dq','bye')),

    -- Bracket wiring
    next_match_id       BIGINT REFERENCES matches(id),
    next_match_slot     INT CHECK (next_match_slot IN (1, 2)),
    loser_next_match_id BIGINT REFERENCES matches(id),
    loser_next_match_slot INT CHECK (loser_next_match_slot IN (1, 2)),

    -- Referee / notes
    referee_user_id     BIGINT REFERENCES users(id),
    notes               TEXT,

    -- Quick match expiry
    expires_at          TIMESTAMPTZ,

    -- Timestamps
    scheduled_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_matches_public_id ON matches(public_id);
CREATE INDEX idx_matches_division_id ON matches(division_id) WHERE division_id IS NOT NULL;
CREATE INDEX idx_matches_pod_id ON matches(pod_id) WHERE pod_id IS NOT NULL;
CREATE INDEX idx_matches_court_id ON matches(court_id) WHERE court_id IS NOT NULL;
CREATE INDEX idx_matches_tournament_id ON matches(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_team1 ON matches(team1_id) WHERE team1_id IS NOT NULL;
CREATE INDEX idx_matches_team2 ON matches(team2_id) WHERE team2_id IS NOT NULL;
CREATE INDEX idx_matches_court_active ON matches(court_id, status) WHERE status IN ('warmup','in_progress','paused');
CREATE INDEX idx_matches_quick_expires ON matches(expires_at) WHERE match_type = 'quick' AND expires_at IS NOT NULL;
CREATE INDEX idx_matches_next_match ON matches(next_match_id) WHERE next_match_id IS NOT NULL;
CREATE INDEX idx_matches_loser_next_match ON matches(loser_next_match_id) WHERE loser_next_match_id IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS matches;
