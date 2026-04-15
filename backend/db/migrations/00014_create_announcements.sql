-- +goose Up
CREATE TABLE announcements (
    id                  BIGSERIAL PRIMARY KEY,
    tournament_id       BIGINT REFERENCES tournaments(id),
    league_id           BIGINT REFERENCES leagues(id),
    division_id         BIGINT REFERENCES divisions(id),
    title               TEXT NOT NULL,
    body                TEXT NOT NULL,
    is_pinned           BOOLEAN DEFAULT false,
    created_by_user_id  BIGINT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    -- At least one scope must be set
    CHECK (tournament_id IS NOT NULL OR league_id IS NOT NULL)
);

CREATE INDEX idx_announcements_tournament ON announcements(tournament_id)
    WHERE tournament_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_announcements_league ON announcements(league_id)
    WHERE league_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_announcements_division ON announcements(division_id)
    WHERE division_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_announcements_pinned ON announcements(is_pinned, created_at DESC)
    WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS announcements;
