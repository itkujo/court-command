-- +goose Up
CREATE TABLE tournament_courts (
    id              BIGSERIAL PRIMARY KEY,
    tournament_id   BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    court_id        BIGINT NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    is_temporary    BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_tournament_courts_unique ON tournament_courts(tournament_id, court_id);
CREATE INDEX idx_tournament_courts_tournament ON tournament_courts(tournament_id);
CREATE INDEX idx_tournament_courts_court ON tournament_courts(court_id);

-- +goose Down
DROP TABLE IF EXISTS tournament_courts;
