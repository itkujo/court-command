-- +goose Up
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sequence for CC-XXXXX public IDs
CREATE SEQUENCE IF NOT EXISTS user_public_id_seq START 10000;

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    public_id       TEXT NOT NULL UNIQUE DEFAULT 'CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'),
    email           TEXT UNIQUE,
    password_hash   TEXT NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    date_of_birth   DATE NOT NULL,
    display_name    TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'unclaimed', 'merged')),
    merged_into_id  BIGINT REFERENCES users(id),
    role            TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('platform_admin', 'player')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_public_id ON users(public_id);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_dedup ON users(first_name, last_name, date_of_birth) WHERE status != 'merged' AND deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS users;
DROP SEQUENCE IF EXISTS user_public_id_seq;
