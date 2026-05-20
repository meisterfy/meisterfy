-- +goose Up
CREATE TABLE post_insights (
    id                TEXT PRIMARY KEY,
    publish_result_id TEXT NOT NULL REFERENCES post_publish_results(id) ON DELETE CASCADE,
    post_id           TEXT NOT NULL,
    platform          TEXT NOT NULL,
    insight_window    TEXT NOT NULL CHECK (insight_window IN ('24h','7d','30d')),
    metrics           JSONB NOT NULL DEFAULT '{}',
    raw_response      JSONB NOT NULL DEFAULT '{}',
    synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (publish_result_id, insight_window)
);

CREATE INDEX idx_post_insights_post_id   ON post_insights(post_id);
CREATE INDEX idx_post_insights_synced_at ON post_insights(synced_at);

-- +goose Down
DROP TABLE IF EXISTS post_insights;
