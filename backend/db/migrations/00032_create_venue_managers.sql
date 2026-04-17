-- +goose Up
CREATE TABLE venue_managers (
    id          BIGSERIAL PRIMARY KEY,
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    role        TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('manager', 'admin')),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    added_by    BIGINT REFERENCES users(id),
    UNIQUE (venue_id, user_id)
);

CREATE INDEX idx_venue_managers_venue ON venue_managers(venue_id);
CREATE INDEX idx_venue_managers_user ON venue_managers(user_id);

-- Backfill: make every venue creator an admin manager
INSERT INTO venue_managers (venue_id, user_id, role, added_by)
SELECT id, created_by_user_id, 'admin', created_by_user_id
FROM venues
WHERE deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS venue_managers;
