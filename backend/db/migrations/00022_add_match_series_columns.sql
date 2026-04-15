-- +goose Up

-- Add series_config JSONB for MLP-style match type configuration
-- Example: {"match_types": ["mens_doubles", "womens_doubles", "mixed_doubles"]}
ALTER TABLE match_series ADD COLUMN series_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Add bracket wiring at the series level
ALTER TABLE match_series ADD COLUMN next_series_id BIGINT REFERENCES match_series(id);
ALTER TABLE match_series ADD COLUMN loser_next_series_id BIGINT REFERENCES match_series(id);

-- Add court and scheduling
ALTER TABLE match_series ADD COLUMN court_id BIGINT REFERENCES courts(id);
ALTER TABLE match_series ADD COLUMN scheduled_at TIMESTAMPTZ;

-- Add notes
ALTER TABLE match_series ADD COLUMN notes TEXT;

CREATE INDEX idx_match_series_court_id ON match_series(court_id) WHERE court_id IS NOT NULL;

-- Also add a query to cancel scheduled child matches when series completes
-- (handled in application code, but we need the status update query)

-- +goose Down
DROP INDEX IF EXISTS idx_match_series_court_id;
ALTER TABLE match_series DROP COLUMN IF EXISTS notes;
ALTER TABLE match_series DROP COLUMN IF EXISTS scheduled_at;
ALTER TABLE match_series DROP COLUMN IF EXISTS court_id;
ALTER TABLE match_series DROP COLUMN IF EXISTS loser_next_series_id;
ALTER TABLE match_series DROP COLUMN IF EXISTS next_series_id;
ALTER TABLE match_series DROP COLUMN IF EXISTS series_config;
