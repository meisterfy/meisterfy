-- name: InsertCampaignAIReport :one
INSERT INTO campaign_ai_reports (id, tenant_id, campaign_id, report_type, content, period_start, period_end, generated_by, model)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ListCampaignAIReports :many
SELECT r.id, r.tenant_id, r.campaign_id, r.report_type, r.content,
       r.period_start, r.period_end, r.generated_at, r.model,
       u.name AS generated_by_name
FROM campaign_ai_reports r
LEFT JOIN users u ON r.generated_by = u.id
WHERE r.tenant_id = $1 AND r.campaign_id = $2 AND r.report_type = $3
ORDER BY r.generated_at DESC
LIMIT $4;
