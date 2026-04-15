-- +goose Up
CREATE TABLE leagues (
    id              BIGSERIAL PRIMARY KEY,
    public_id       TEXT NOT NULL DEFAULT 'CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'active', 'archived', 'cancelled')),
    logo_url        TEXT,
    banner_url      TEXT,
    description     TEXT,
    website_url     TEXT,
    contact_email   TEXT,
    contact_phone   TEXT,
    city            TEXT,
    state_province  TEXT,
    country         TEXT,
    rules_document_url TEXT,
    social_links    JSONB DEFAULT '{}',
    sponsor_info    JSONB DEFAULT '[]',
    notes           TEXT,
    created_by_user_id BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_leagues_slug ON leagues(slug);
CREATE INDEX idx_leagues_public_id ON leagues(public_id);
CREATE INDEX idx_leagues_status ON leagues(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leagues_created_by ON leagues(created_by_user_id);
CREATE INDEX idx_leagues_deleted_at ON leagues(id) WHERE deleted_at IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS leagues;
