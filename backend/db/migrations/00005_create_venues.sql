-- +goose Up
CREATE TABLE venues (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL UNIQUE,
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'archived')),
    address_line_1      TEXT,
    address_line_2      TEXT,
    city                TEXT,
    state_province      TEXT,
    country             TEXT,
    postal_code         TEXT,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    timezone            TEXT,
    website_url         TEXT,
    contact_email       TEXT,
    contact_phone       TEXT,
    logo_url            TEXT,
    photo_url           TEXT,
    venue_map_url       TEXT,
    description         TEXT,
    surface_types       JSONB DEFAULT '[]',
    amenities           JSONB DEFAULT '[]',
    org_id              BIGINT REFERENCES organizations(id),
    managed_by_user_id  BIGINT REFERENCES users(id),
    bio                 TEXT,
    notes               TEXT,
    created_by_user_id  BIGINT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_venues_slug ON venues(slug);
CREATE INDEX idx_venues_status ON venues(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_deleted_at ON venues(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_name ON venues(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_location ON venues(latitude, longitude) WHERE deleted_at IS NULL AND latitude IS NOT NULL;
CREATE INDEX idx_venues_org_id ON venues(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_venues_managed_by ON venues(managed_by_user_id) WHERE managed_by_user_id IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS venues;
