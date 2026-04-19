-- +goose Up
ALTER TABLE matches ADD COLUMN court_queue_position INT;
CREATE INDEX idx_matches_court_queue ON matches(court_id, court_queue_position)
    WHERE court_id IS NOT NULL AND court_queue_position IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_matches_court_queue;
ALTER TABLE matches DROP COLUMN IF EXISTS court_queue_position;
