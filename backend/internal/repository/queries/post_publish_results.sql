-- name: CreatePostPublishResult :exec
INSERT INTO post_publish_results (id, post_id, platform, provider, external_id, status, error_message, published_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: ListPostPublishResultsByPostID :many
SELECT * FROM post_publish_results
WHERE post_id = $1
ORDER BY created_at;

-- name: ExistsPostPublishResultForPost :one
SELECT EXISTS (
    SELECT 1 FROM post_publish_results WHERE post_id = $1
) AS exists;
