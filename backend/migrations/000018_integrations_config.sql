-- +goose Up
ALTER TABLE integrations ADD COLUMN config JSONB NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE integrations DROP COLUMN IF EXISTS config;
