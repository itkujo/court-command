-- +goose Up
CREATE TABLE match_events (
    id              BIGSERIAL PRIMARY KEY,
    match_id        BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sequence_id     INT NOT NULL,

    event_type      TEXT NOT NULL CHECK (event_type IN (
        'point_team1', 'point_team2',
        'side_out',
        'timeout_team1', 'timeout_team2',
        'end_timeout',
        'start_set', 'end_set',
        'start_game', 'end_game',
        'substitution',
        'challenge',
        'fault',
        'undo',
        'note',
        'custom'
    )),

    -- Snapshot of game state BEFORE this event
    team1_score     INT NOT NULL DEFAULT 0,
    team2_score     INT NOT NULL DEFAULT 0,
    current_set     INT NOT NULL DEFAULT 1,
    current_game    INT NOT NULL DEFAULT 1,
    serving_team    INT,
    server_number   INT,
    set_scores      JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Event metadata
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_match_events_match_seq ON match_events(match_id, sequence_id);
CREATE INDEX idx_match_events_match_id ON match_events(match_id);
CREATE INDEX idx_match_events_type ON match_events(match_id, event_type);

-- +goose Down
DROP TABLE IF EXISTS match_events;
