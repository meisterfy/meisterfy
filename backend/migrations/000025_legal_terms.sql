-- +goose Up
CREATE TABLE legal_term_versions (
    id              TEXT PRIMARY KEY,
    version         INT  NOT NULL UNIQUE,
    fallback_locale TEXT NOT NULL DEFAULT 'en',
    translations    JSONB NOT NULL,
    effective_at    TIMESTAMPTZ NOT NULL,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_legal_acceptances (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_id  TEXT NOT NULL REFERENCES legal_term_versions(id),
    locale_seen TEXT,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip          TEXT,
    PRIMARY KEY (user_id, version_id)
);

-- +goose Down
DROP TABLE IF EXISTS user_legal_acceptances;
DROP TABLE IF EXISTS legal_term_versions;
