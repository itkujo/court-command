-- +goose Up
CREATE TABLE league_registrations (
    id              BIGSERIAL PRIMARY KEY,
    league_id       BIGINT NOT NULL REFERENCES leagues(id),
    org_id          BIGINT NOT NULL REFERENCES organizations(id),
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'withdrawn')),
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at     TIMESTAMPTZ,
    notes           TEXT,

    UNIQUE (league_id, org_id)
);

CREATE INDEX idx_league_registrations_league ON league_registrations(league_id);
CREATE INDEX idx_league_registrations_org ON league_registrations(org_id);

-- +goose Down
DROP TABLE IF EXISTS league_registrations;
