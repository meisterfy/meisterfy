-- name: GetLatestLegalTermVersion :one
SELECT id, version, fallback_locale, translations, effective_at, created_by, created_at
FROM legal_term_versions
WHERE effective_at <= NOW()
ORDER BY version DESC
LIMIT 1;

-- name: GetLegalTermVersionByID :one
SELECT id, version, fallback_locale, translations, effective_at, created_by, created_at
FROM legal_term_versions
WHERE id = $1;

-- name: ListLegalTermVersions :many
SELECT id, version, fallback_locale, translations, effective_at, created_by, created_at
FROM legal_term_versions
ORDER BY version DESC;

-- name: GetMaxLegalTermVersion :one
SELECT COALESCE(MAX(version), 0) AS max_version FROM legal_term_versions;

-- name: CreateLegalTermVersion :exec
INSERT INTO legal_term_versions (id, version, fallback_locale, translations, effective_at, created_by)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: UpdateLegalTermVersion :exec
UPDATE legal_term_versions
SET fallback_locale = $2, translations = $3, effective_at = $4
WHERE id = $1;

-- name: HasUserAcceptedLegalVersion :one
SELECT EXISTS (
    SELECT 1 FROM user_legal_acceptances
    WHERE user_id = $1 AND version_id = $2
) AS accepted;

-- name: RecordLegalAcceptance :exec
INSERT INTO user_legal_acceptances (user_id, version_id, locale_seen, ip)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, version_id) DO NOTHING;
