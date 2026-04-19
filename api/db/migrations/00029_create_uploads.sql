-- +goose Up
CREATE TABLE uploads (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    filename        TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    content_type    TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    entity_type     TEXT,
    entity_id       BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_entity ON uploads(entity_type, entity_id);

-- +goose Down
DROP TABLE IF EXISTS uploads;
