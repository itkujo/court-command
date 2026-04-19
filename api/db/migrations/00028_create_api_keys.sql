-- +goose Up
CREATE TABLE api_keys (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    name            TEXT NOT NULL,
    key_hash        TEXT NOT NULL UNIQUE,
    key_prefix      TEXT NOT NULL,
    scopes          TEXT[] NOT NULL DEFAULT '{}',
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE is_active = true;
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);

-- +goose Down
DROP TABLE IF EXISTS api_keys;
