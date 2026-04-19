-- +goose Up
CREATE TABLE organizations (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    logo_url        TEXT,
    primary_color   TEXT,
    secondary_color TEXT,
    website_url     TEXT,
    contact_email   TEXT,
    contact_phone   TEXT,
    city            TEXT,
    state_province  TEXT,
    country         TEXT,
    bio             TEXT,
    founded_year    INT,
    social_links    JSONB DEFAULT '{}',
    created_by_user_id BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_orgs_slug ON organizations(slug);
CREATE INDEX idx_orgs_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_name ON organizations(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_created_by ON organizations(created_by_user_id);

-- Add FK from teams.org_id to organizations.id
ALTER TABLE teams ADD CONSTRAINT fk_teams_org FOREIGN KEY (org_id) REFERENCES organizations(id);

CREATE TABLE org_memberships (
    id              BIGSERIAL PRIMARY KEY,
    org_id          BIGINT NOT NULL REFERENCES organizations(id),
    player_id       BIGINT NOT NULL REFERENCES users(id),
    role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at         TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, player_id, left_at)
);

CREATE INDEX idx_org_memberships_org ON org_memberships(org_id) WHERE left_at IS NULL;
CREATE INDEX idx_org_memberships_player ON org_memberships(player_id) WHERE left_at IS NULL;

CREATE TABLE org_blocks (
    id              BIGSERIAL PRIMARY KEY,
    player_id       BIGINT NOT NULL REFERENCES users(id),
    org_id          BIGINT NOT NULL REFERENCES organizations(id),
    blocked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (player_id, org_id)
);

CREATE INDEX idx_org_blocks_player ON org_blocks(player_id);

-- +goose Down
DROP TABLE IF EXISTS org_blocks;
DROP TABLE IF EXISTS org_memberships;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS fk_teams_org;
DROP TABLE IF EXISTS organizations;
