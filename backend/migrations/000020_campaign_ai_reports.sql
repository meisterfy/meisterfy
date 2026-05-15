-- +goose Up
CREATE TABLE campaign_ai_reports (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     text NOT NULL,
    campaign_id   text NOT NULL,
    report_type   text NOT NULL CHECK (report_type IN ('instant', 'daily', 'weekly', 'monthly')),
    content       text NOT NULL,
    period_start  date,
    period_end    date,
    generated_at  timestamptz NOT NULL DEFAULT now(),
    generated_by  text REFERENCES users(id) ON DELETE SET NULL,
    model         text
);

CREATE INDEX idx_campaign_ai_reports_lookup
    ON campaign_ai_reports (tenant_id, campaign_id, report_type, generated_at DESC);

-- +goose Down
DROP TABLE IF EXISTS campaign_ai_reports;
