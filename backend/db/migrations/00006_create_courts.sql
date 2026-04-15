-- +goose Up
CREATE TABLE courts (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    venue_id        BIGINT REFERENCES venues(id),
    surface_type    TEXT CHECK (surface_type IN ('indoor_hard', 'outdoor_concrete', 'outdoor_sport_court', 'outdoor_wood', 'temporary', 'other')),
    is_show_court   BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_temporary    BOOLEAN NOT NULL DEFAULT false,
    sort_order      INT NOT NULL DEFAULT 0,
    notes           TEXT,
    stream_url      TEXT,
    stream_type     TEXT CHECK (stream_type IN ('youtube', 'twitch', 'vimeo', 'hls', 'other')),
    stream_is_live  BOOLEAN NOT NULL DEFAULT false,
    stream_title    TEXT,
    created_by_user_id BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_courts_slug_venue ON courts(venue_id, slug) WHERE venue_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_courts_slug_global ON courts(slug) WHERE venue_id IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_courts_venue_id ON courts(venue_id) WHERE venue_id IS NOT NULL;
CREATE INDEX idx_courts_deleted_at ON courts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_courts_active ON courts(is_active) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS courts;
