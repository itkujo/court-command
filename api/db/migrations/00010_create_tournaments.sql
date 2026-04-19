-- +goose Up
CREATE TABLE tournaments (
    id                  BIGSERIAL PRIMARY KEY,
    public_id           TEXT NOT NULL DEFAULT 'CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'),
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL UNIQUE,
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                            'draft', 'published', 'registration_open',
                            'registration_closed', 'in_progress',
                            'completed', 'archived', 'cancelled'
                        )),
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    venue_id            BIGINT REFERENCES venues(id),
    league_id           BIGINT REFERENCES leagues(id),
    season_id           BIGINT REFERENCES seasons(id),
    description         TEXT,
    logo_url            TEXT,
    banner_url          TEXT,
    contact_email       TEXT,
    contact_phone       TEXT,
    website_url         TEXT,
    registration_open_at  TIMESTAMPTZ,
    registration_close_at TIMESTAMPTZ,
    max_participants    INT,
    rules_document_url  TEXT,
    cancellation_reason TEXT,
    social_links        JSONB DEFAULT '{}',
    notes               TEXT,
    sponsor_info        JSONB DEFAULT '[]',
    show_registrations  BOOLEAN DEFAULT true,
    created_by_user_id  BIGINT NOT NULL REFERENCES users(id),
    td_user_id          BIGINT REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_tournaments_slug ON tournaments(slug);
CREATE INDEX idx_tournaments_public_id ON tournaments(public_id);
CREATE INDEX idx_tournaments_status ON tournaments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_league ON tournaments(league_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_season ON tournaments(season_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_venue ON tournaments(venue_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_created_by ON tournaments(created_by_user_id);
CREATE INDEX idx_tournaments_td ON tournaments(td_user_id) WHERE td_user_id IS NOT NULL;
CREATE INDEX idx_tournaments_dates ON tournaments(start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_deleted_at ON tournaments(id) WHERE deleted_at IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS tournaments;
