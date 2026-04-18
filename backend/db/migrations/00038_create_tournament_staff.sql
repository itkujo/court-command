-- +goose Up
CREATE TABLE tournament_staff (
    id BIGSERIAL PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('referee', 'scorekeeper')),
    raw_password TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tournament_id, role)
);

CREATE INDEX idx_tournament_staff_tournament ON tournament_staff(tournament_id);
CREATE INDEX idx_tournament_staff_user ON tournament_staff(user_id);

-- +goose Down
DROP TABLE IF EXISTS tournament_staff;
