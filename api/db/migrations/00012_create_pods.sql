-- +goose Up
CREATE TABLE pods (
    id              BIGSERIAL PRIMARY KEY,
    division_id     BIGINT NOT NULL REFERENCES divisions(id),
    name            TEXT NOT NULL,
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE (division_id, name)
);

CREATE INDEX idx_pods_division ON pods(division_id) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS pods;
