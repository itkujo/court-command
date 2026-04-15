-- +goose Up
CREATE TABLE activity_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    action          TEXT NOT NULL,
    entity_type     TEXT NOT NULL,
    entity_id       BIGINT,
    metadata        JSONB,
    ip_address      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- +goose Down
DROP TABLE IF EXISTS activity_logs;
