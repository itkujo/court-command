-- +goose Up
CREATE TABLE season_confirmations (
    id              BIGSERIAL PRIMARY KEY,
    season_id       BIGINT NOT NULL REFERENCES seasons(id),
    team_id         BIGINT NOT NULL REFERENCES teams(id),
    division_id     BIGINT NOT NULL REFERENCES divisions(id),
    confirmed       BOOLEAN DEFAULT false,
    confirmed_at    TIMESTAMPTZ,
    deadline        TIMESTAMPTZ NOT NULL,

    UNIQUE (season_id, team_id, division_id)
);

CREATE INDEX idx_season_confirmations_season ON season_confirmations(season_id);
CREATE INDEX idx_season_confirmations_team ON season_confirmations(team_id);

-- +goose Down
DROP TABLE IF EXISTS season_confirmations;
