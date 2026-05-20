-- +goose Up
ALTER TABLE daily_metrics
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'google_ads';

CREATE INDEX IF NOT EXISTS idx_daily_metrics_provider ON daily_metrics(provider);

-- +goose Down
DROP INDEX IF EXISTS idx_daily_metrics_provider;
ALTER TABLE daily_metrics DROP COLUMN IF EXISTS provider;
