-- name: UpsertPostInsight :exec
INSERT INTO post_insights (id, publish_result_id, post_id, platform, insight_window, metrics, raw_response, synced_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
ON CONFLICT (publish_result_id, insight_window) DO UPDATE
  SET metrics      = EXCLUDED.metrics,
      raw_response = EXCLUDED.raw_response,
      synced_at    = NOW();

-- name: ListPostInsightsByPostID :many
SELECT * FROM post_insights
WHERE post_id = $1
ORDER BY synced_at DESC;

-- name: ListPendingInsightSync :many
SELECT ppr.*, p.tenant_id AS post_tenant_id
FROM post_publish_results ppr
JOIN posts p ON p.id = ppr.post_id
LEFT JOIN post_insights pi ON pi.publish_result_id = ppr.id AND pi.insight_window = $1
WHERE ppr.status = 'published'
  AND ppr.published_at >= $2
  AND ppr.published_at <  $3
  AND pi.id IS NULL;
