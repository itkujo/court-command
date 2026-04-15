-- +goose Up
CREATE TABLE registrations (
    id                  BIGSERIAL PRIMARY KEY,
    division_id         BIGINT NOT NULL REFERENCES divisions(id),
    team_id             BIGINT REFERENCES teams(id),
    player_id           BIGINT REFERENCES users(id),
    registered_by_user_id BIGINT NOT NULL REFERENCES users(id),
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                            'pending', 'approved', 'waitlisted', 'withdrawn',
                            'rejected', 'checked_in', 'no_show', 'withdrawn_mid_tournament'
                        )),
    seed                INT,
    final_placement     INT,
    registration_notes  TEXT,
    admin_notes         TEXT,
    seeking_partner     BOOLEAN DEFAULT false,
    registered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at         TIMESTAMPTZ,
    withdrawn_at        TIMESTAMPTZ,
    checked_in_at       TIMESTAMPTZ,

    -- At least one of team_id or player_id must be set
    CHECK (team_id IS NOT NULL OR player_id IS NOT NULL)
);

CREATE INDEX idx_registrations_division ON registrations(division_id);
CREATE INDEX idx_registrations_team ON registrations(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_registrations_player ON registrations(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX idx_registrations_status ON registrations(division_id, status);
CREATE UNIQUE INDEX idx_registrations_unique_team ON registrations(division_id, team_id)
    WHERE team_id IS NOT NULL AND status NOT IN ('withdrawn', 'rejected');
CREATE UNIQUE INDEX idx_registrations_unique_player ON registrations(division_id, player_id)
    WHERE player_id IS NOT NULL AND status NOT IN ('withdrawn', 'rejected');

-- +goose Down
DROP TABLE IF EXISTS registrations;
