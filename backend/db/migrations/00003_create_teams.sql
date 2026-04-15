-- +goose Up
CREATE TABLE teams (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    short_name      TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    logo_url        TEXT,
    primary_color   TEXT,
    secondary_color TEXT,
    org_id          BIGINT,
    city            TEXT,
    founded_year    INT,
    bio             TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_teams_slug ON teams(slug);
CREATE INDEX idx_teams_org_id ON teams(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_teams_deleted_at ON teams(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_teams_name ON teams(name) WHERE deleted_at IS NULL;

CREATE TABLE team_rosters (
    id              BIGSERIAL PRIMARY KEY,
    team_id         BIGINT NOT NULL REFERENCES teams(id),
    player_id       BIGINT NOT NULL REFERENCES users(id),
    role            TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'captain', 'substitute')),
    jersey_number   INT,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at         TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, player_id, left_at)
);

CREATE INDEX idx_team_rosters_team ON team_rosters(team_id) WHERE left_at IS NULL;
CREATE INDEX idx_team_rosters_player ON team_rosters(player_id) WHERE left_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS team_rosters;
DROP TABLE IF EXISTS teams;
