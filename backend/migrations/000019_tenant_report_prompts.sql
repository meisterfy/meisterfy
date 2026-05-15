-- +goose Up
ALTER TABLE tenants ADD COLUMN report_prompts jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE tenants DROP COLUMN report_prompts;
