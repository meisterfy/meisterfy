-- +goose Up
CREATE TABLE post_publish_results (
    id            TEXT PRIMARY KEY,
    post_id       TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    platform      TEXT NOT NULL,
    provider      TEXT NOT NULL,
    external_id   TEXT,
    status        TEXT NOT NULL CHECK (status IN ('published','failed')),
    error_message TEXT,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_publish_results_post_id ON post_publish_results(post_id);
CREATE INDEX idx_post_publish_results_status  ON post_publish_results(status, published_at);

-- +goose Down
DROP TABLE IF EXISTS post_publish_results;
