# Platform RBAC + Legal Terms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a platform-level `system_role` to users, a versioned legal-terms system with locale-aware acceptance wall, and a `/settings/legal` management UI — all guarded by `RequireSystemRole("platform_admin")`.

**Architecture:** `system_role TEXT` column on `users` table flows into JWT claims and a new `RequireSystemRole` middleware. Legal terms live in two tables (`legal_term_versions` + `user_legal_acceptances`); locale resolution is a single domain method. The frontend acceptance wall sits in the root layout and is driven by `pending_terms` from login/refresh responses, mirroring the existing `needs_tenant` pattern.

**Tech Stack:** Go (chi, pgx/v5, sqlc, goose), SvelteKit (Svelte 5 runes), Tailwind v4, Bits UI, paraglide i18n.

---

## File Map

### Backend — New files
- `backend/migrations/000024_system_role.sql`
- `backend/migrations/000025_legal_terms.sql`
- `backend/migrations/000026_seed_legal_terms.sql`
- `backend/internal/domain/legal.go`
- `backend/internal/repository/queries/legal.sql`
- `backend/internal/repository/db/legal.sql.go` ← sqlc-generated (do not edit)
- `backend/internal/repository/legal.go`
- `backend/internal/api/legal.go`

### Backend — Modified files
- `backend/internal/domain/user.go` — add `SystemRole` to `User` + `UserClaims`; add `IsPlatformAdmin()`
- `backend/internal/domain/jwt.go` — embed `system_role` in JWT
- `backend/internal/repository/queries/users.sql` — add `system_role` to SELECT/UPDATE; add `SetUserSystemRole`
- `backend/internal/repository/db/users.sql.go` ← sqlc-generated after query changes
- `backend/internal/repository/db/models.go` ← sqlc-generated after migration
- `backend/internal/repository/user.go` — update `mapUser`; add `SetSystemRole`
- `backend/internal/middleware/admin_auth.go` — add `RequireSystemRole`
- `backend/internal/api/auth.go` — inject `legalRepo`; add `system_role` to tokens; add `pending_terms` to responses; add `AcceptTerms` handler
- `backend/internal/api/admin_users.go` — add `SetSystemRole` handler
- `backend/cmd/server/main.go` — wire `legalRepo`, legal routes, integrations guard, system-role route

### Frontend — New files
- `frontend/src/lib/api/legal.ts`
- `frontend/src/lib/components/ui/terms-wall/terms-wall.svelte`
- `frontend/src/routes/settings/legal/+page.ts`
- `frontend/src/routes/settings/legal/+page.svelte`

### Frontend — Modified files
- `frontend/src/lib/stores/auth.svelte.ts` — add `system_role`, `pendingTerms`, `acceptTerms()`
- `frontend/src/routes/+layout.svelte` — terms wall guard
- `frontend/src/routes/+layout.ts` — read `pending_terms` from session
- `frontend/src/routes/settings/+layout.svelte` — add Legal nav link
- `frontend/src/routes/settings/+page.ts` — redirect guard by `system_role`
- `frontend/src/routes/settings/integrations/+page.ts` — add `system_role` guard
- `frontend/src/routes/[tenant]/settings/users/+page.svelte` — add system-role toggle
- `frontend/locales/en/settings.json`
- `frontend/locales/pt-BR/settings.json`

---

## Task 1: DB Migration — `system_role` on users

**Files:**
- Create: `backend/migrations/000024_system_role.sql`

- [ ] **Step 1: Write the migration**

```sql
-- +goose Up
ALTER TABLE users
    ADD COLUMN system_role TEXT NOT NULL DEFAULT 'user'
        CHECK (system_role IN ('user', 'platform_admin'));

-- +goose Down
ALTER TABLE users DROP COLUMN system_role;
```

- [ ] **Step 2: Apply the migration**

```bash
cd backend && goose -dir migrations postgres "$DATABASE_URL" up
```

Expected: `OK    000024_system_role.sql`

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/000024_system_role.sql
git commit -m "chore: add system_role column to users"
```

---

## Task 2: DB Migration — legal terms tables

**Files:**
- Create: `backend/migrations/000025_legal_terms.sql`

- [ ] **Step 1: Write the migration**

```sql
-- +goose Up
CREATE TABLE legal_term_versions (
    id              TEXT PRIMARY KEY,
    version         INT  NOT NULL UNIQUE,
    fallback_locale TEXT NOT NULL DEFAULT 'en',
    translations    JSONB NOT NULL,
    effective_at    TIMESTAMPTZ NOT NULL,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_legal_acceptances (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_id  TEXT NOT NULL REFERENCES legal_term_versions(id),
    locale_seen TEXT,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip          TEXT,
    PRIMARY KEY (user_id, version_id)
);

-- +goose Down
DROP TABLE IF EXISTS user_legal_acceptances;
DROP TABLE IF EXISTS legal_term_versions;
```

- [ ] **Step 2: Apply the migration**

```bash
cd backend && goose -dir migrations postgres "$DATABASE_URL" up
```

Expected: `OK    000025_legal_terms.sql`

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/000025_legal_terms.sql
git commit -m "chore: add legal_term_versions and user_legal_acceptances tables"
```

---

## Task 3: DB Migration — seed default terms

**Files:**
- Create: `backend/migrations/000026_seed_legal_terms.sql`

- [ ] **Step 1: Write the seed migration**

```sql
-- +goose Up
INSERT INTO legal_term_versions (id, version, fallback_locale, translations, effective_at)
VALUES (
    'ltv_default_v1',
    1,
    'en',
    '{
        "en": [
            {
                "title": "Terms of Use",
                "content": "By accessing this platform, you agree to use it in accordance with applicable laws and these terms. Unauthorized use, reproduction, or distribution of platform content is prohibited."
            },
            {
                "title": "Privacy & Data",
                "content": "We collect and process personal data to provide our services. Your data is stored securely and not shared with third parties without your consent, except as required by law."
            }
        ],
        "pt-BR": [
            {
                "title": "Termos de Uso",
                "content": "Ao acessar esta plataforma, você concorda em utilizá-la em conformidade com as leis aplicáveis e estes termos. É proibido o uso não autorizado, reprodução ou distribuição do conteúdo da plataforma."
            },
            {
                "title": "Privacidade e Dados",
                "content": "Coletamos e processamos dados pessoais para prestação dos nossos serviços, em conformidade com a LGPD. Seus dados são armazenados com segurança e não são compartilhados com terceiros sem seu consentimento, salvo exigência legal."
            }
        ]
    }',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- +goose Down
DELETE FROM legal_term_versions WHERE id = 'ltv_default_v1';
```

- [ ] **Step 2: Apply**

```bash
cd backend && goose -dir migrations postgres "$DATABASE_URL" up
```

Expected: `OK    000026_seed_legal_terms.sql`

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/000026_seed_legal_terms.sql
git commit -m "chore: seed default legal terms (en + pt-BR)"
```

---

## Task 4: Domain layer updates

**Files:**
- Modify: `backend/internal/domain/user.go`
- Modify: `backend/internal/domain/jwt.go`
- Create: `backend/internal/domain/legal.go`

- [ ] **Step 1: Extend `User` and `UserClaims` in `user.go`**

Add `SystemRole string` to both structs and add the helper method. Full updated file:

```go
package domain

import (
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID           string
	Name         string
	Email        string
	PasswordHash string
	Locale       string
	Timezone     string
	IsActive     bool
	SystemRole   string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Role struct {
	ID          string
	Name        string
	TenantID    *string
	Permissions []string
}

type Permission struct {
	ID   string
	Name string
}

type UserClaims struct {
	UserID      string
	UserName    string
	TenantID    string
	Permissions []string
	SystemRole  string
}

func (u *User) SetPassword(plain string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), 12)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hash)
	return nil
}

func (u *User) CheckPassword(plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(plain)) == nil
}

func (c *UserClaims) HasPermission(name string) bool {
	for _, p := range c.Permissions {
		if p == name {
			return true
		}
	}
	return false
}

func (c *UserClaims) IsPlatformAdmin() bool {
	return c.SystemRole == "platform_admin"
}
```

- [ ] **Step 2: Embed `system_role` in JWT (`jwt.go`)**

Add `SystemRole string \`json:"sr,omitempty"\`` to `accessClaims`. Update `IssueTokenPair` and `ParseAccessToken`:

```go
type accessClaims struct {
	jwt.RegisteredClaims
	TenantID    string   `json:"tid"`
	Permissions []string `json:"perms"`
	UserName    string   `json:"uname,omitempty"`
	SystemRole  string   `json:"sr,omitempty"`
}
```

In `IssueTokenPair`, set `SystemRole: claims.SystemRole` in the `accessClaims` struct.

In `ParseAccessToken`, return:
```go
return &UserClaims{
    UserID:      ac.Subject,
    TenantID:    ac.TenantID,
    Permissions: ac.Permissions,
    UserName:    ac.UserName,
    SystemRole:  ac.SystemRole,
}, nil
```

- [ ] **Step 3: Create `legal.go`**

```go
package domain

import (
	"strings"
	"time"
)

type TermBlock struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type LegalTermVersion struct {
	ID             string
	Version        int
	FallbackLocale string
	Translations   map[string][]TermBlock
	EffectiveAt    time.Time
	CreatedBy      *string
	CreatedAt      time.Time
}

// ResolveBlocks returns blocks for the best matching locale.
// Priority: exact locale → base language (e.g. "pt" from "pt-BR") → FallbackLocale.
func (v *LegalTermVersion) ResolveBlocks(locale string) ([]TermBlock, string) {
	if b, ok := v.Translations[locale]; ok {
		return b, locale
	}
	if idx := strings.Index(locale, "-"); idx > 0 {
		base := locale[:idx]
		if b, ok := v.Translations[base]; ok {
			return b, base
		}
	}
	return v.Translations[v.FallbackLocale], v.FallbackLocale
}
```

- [ ] **Step 4: Verify compilation**

```bash
cd backend && go build ./internal/domain/...
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/domain/
git commit -m "feat: add SystemRole to UserClaims+JWT and legal domain types"
```

---

## Task 5: sqlc — update user queries and generate

**Files:**
- Modify: `backend/internal/repository/queries/users.sql`
- Modified by sqlc: `backend/internal/repository/db/users.sql.go`, `backend/internal/repository/db/models.go`

- [ ] **Step 1: Update `users.sql`**

Replace the full file:

```sql
-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1 LIMIT 1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1 LIMIT 1;

-- name: ListUsers :many
SELECT * FROM users ORDER BY created_at DESC;

-- name: CreateUser :exec
INSERT INTO users (id, name, email, password_hash, locale, timezone, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: UpdateUser :exec
UPDATE users
SET name = $2, email = $3, locale = $4, timezone = $5, is_active = $6, updated_at = NOW()
WHERE id = $1;

-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1;

-- name: SetUserSystemRole :exec
UPDATE users SET system_role = $2, updated_at = NOW() WHERE id = $1;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;

-- name: CountUsers :one
SELECT COUNT(*) FROM users;
```

- [ ] **Step 2: Create `legal.sql`**

Create `backend/internal/repository/queries/legal.sql`:

```sql
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
```

- [ ] **Step 3: Run sqlc generate**

```bash
cd backend && sqlc generate
```

Expected: no errors; `db/users.sql.go`, `db/legal.sql.go`, `db/models.go` updated.

- [ ] **Step 4: Verify compilation**

```bash
cd backend && go build ./internal/repository/db/...
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/repository/queries/ backend/internal/repository/db/
git commit -m "chore: add system_role and legal term sqlc queries"
```

---

## Task 6: Repository — update UserRepository

**Files:**
- Modify: `backend/internal/repository/user.go`

- [ ] **Step 1: Update `mapUser` to include `SystemRole`**

Replace the `mapUser` function and add `SetSystemRole`:

```go
func (r *UserRepository) SetSystemRole(ctx context.Context, userID, role string) error {
	return mapError(r.queries.SetUserSystemRole(ctx, db.SetUserSystemRoleParams{
		ID:         userID,
		SystemRole: role,
	}))
}

func mapUser(row db.User) *domain.User {
	return &domain.User{
		ID:           row.ID,
		Name:         row.Name,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		Locale:       row.Locale,
		Timezone:     row.Timezone,
		IsActive:     row.IsActive,
		SystemRole:   row.SystemRole,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd backend && go build ./internal/repository/...
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/repository/user.go
git commit -m "feat: propagate system_role through UserRepository"
```

---

## Task 7: Repository — LegalRepository (new)

**Files:**
- Create: `backend/internal/repository/legal.go`

- [ ] **Step 1: Write the repository**

```go
package repository

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/repository/db"
)

type LegalRepository struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewLegalRepository(pool *pgxpool.Pool) *LegalRepository {
	return &LegalRepository{pool: pool, queries: db.New(pool)}
}

func (r *LegalRepository) GetLatestVersion(ctx context.Context) (*domain.LegalTermVersion, error) {
	row, err := r.queries.GetLatestLegalTermVersion(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	return mapLegalVersion(row)
}

func (r *LegalRepository) GetVersionByID(ctx context.Context, id string) (*domain.LegalTermVersion, error) {
	row, err := r.queries.GetLegalTermVersionByID(ctx, id)
	if err != nil {
		return nil, mapError(err)
	}
	return mapLegalVersion(row)
}

func (r *LegalRepository) ListVersions(ctx context.Context) ([]domain.LegalTermVersion, error) {
	rows, err := r.queries.ListLegalTermVersions(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	out := make([]domain.LegalTermVersion, 0, len(rows))
	for _, row := range rows {
		v, err := mapLegalVersion(row)
		if err != nil {
			return nil, err
		}
		out = append(out, *v)
	}
	return out, nil
}

func (r *LegalRepository) CreateVersion(ctx context.Context, v *domain.LegalTermVersion) error {
	maxVersion, err := r.queries.GetMaxLegalTermVersion(ctx)
	if err != nil {
		return mapError(err)
	}
	v.Version = int(maxVersion) + 1

	raw, err := json.Marshal(v.Translations)
	if err != nil {
		return err
	}
	return mapError(r.queries.CreateLegalTermVersion(ctx, db.CreateLegalTermVersionParams{
		ID:             v.ID,
		Version:        int32(v.Version),
		FallbackLocale: v.FallbackLocale,
		Translations:   raw,
		EffectiveAt:    v.EffectiveAt,
		CreatedBy:      v.CreatedBy,
	}))
}

func (r *LegalRepository) UpdateVersion(ctx context.Context, v *domain.LegalTermVersion) error {
	raw, err := json.Marshal(v.Translations)
	if err != nil {
		return err
	}
	return mapError(r.queries.UpdateLegalTermVersion(ctx, db.UpdateLegalTermVersionParams{
		ID:             v.ID,
		FallbackLocale: v.FallbackLocale,
		Translations:   raw,
		EffectiveAt:    v.EffectiveAt,
	}))
}

func (r *LegalRepository) HasUserAccepted(ctx context.Context, userID, versionID string) (bool, error) {
	accepted, err := r.queries.HasUserAcceptedLegalVersion(ctx, db.HasUserAcceptedLegalVersionParams{
		UserID:    userID,
		VersionID: versionID,
	})
	return accepted, mapError(err)
}

func (r *LegalRepository) RecordAcceptance(ctx context.Context, userID, versionID, locale, ip string) error {
	return mapError(r.queries.RecordLegalAcceptance(ctx, db.RecordLegalAcceptanceParams{
		UserID:    userID,
		VersionID: versionID,
		LocaleSeen: &locale,
		Ip:         &ip,
	}))
}

func mapLegalVersion(row db.GetLatestLegalTermVersionRow) (*domain.LegalTermVersion, error) {
	var translations map[string][]domain.TermBlock
	if err := json.Unmarshal(row.Translations, &translations); err != nil {
		return nil, err
	}
	return &domain.LegalTermVersion{
		ID:             row.ID,
		Version:        int(row.Version),
		FallbackLocale: row.FallbackLocale,
		Translations:   translations,
		EffectiveAt:    row.EffectiveAt,
		CreatedBy:      row.CreatedBy,
		CreatedAt:      row.CreatedAt,
	}, nil
}
```

> **Note:** sqlc generates separate row types per query when return columns differ. `GetLatestLegalTermVersionRow`, `GetLegalTermVersionByIDRow`, and `ListLegalTermVersionsRow` will have identical fields — extract a shared `mapLegalVersionFromFields` helper that accepts each field individually, or cast via a common struct. Check generated types after `sqlc generate` and adjust accordingly. The shape is: `(id, version, fallback_locale, translations, effective_at, created_by, created_at)` — same for all three queries, so sqlc may reuse one type.

- [ ] **Step 2: Verify compilation**

```bash
cd backend && go build ./internal/repository/...
```

Expected: no errors. If sqlc generated different row types per query, extract a `mapLegalFromRow` accepting raw fields: `id string, version int32, fallback_locale string, translations json.RawMessage, effective_at time.Time, created_by *string, created_at time.Time`.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/repository/legal.go
git commit -m "feat: LegalRepository with versioned terms CRUD and acceptance tracking"
```

---

## Task 8: Middleware — `RequireSystemRole`

**Files:**
- Modify: `backend/internal/middleware/admin_auth.go`

- [ ] **Step 1: Add the middleware function**

Append to `admin_auth.go`:

```go
func RequireSystemRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := UserClaimsFromContext(r.Context())
			if claims == nil {
				writeErr(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if claims.SystemRole != role {
				writeErr(w, http.StatusForbidden, "forbidden")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd backend && go build ./internal/middleware/...
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/middleware/admin_auth.go
git commit -m "feat: RequireSystemRole middleware"
```

---

## Task 9: Auth handler — system_role in tokens + pending_terms + AcceptTerms

**Files:**
- Modify: `backend/internal/api/auth.go`

- [ ] **Step 1: Add `legalRepo` interface to `AuthHandler`**

Add to the `AuthHandler` struct:

```go
legalRepo interface {
    GetLatestVersion(ctx context.Context) (*domain.LegalTermVersion, error)
    HasUserAccepted(ctx context.Context, userID, versionID string) (bool, error)
    RecordAcceptance(ctx context.Context, userID, versionID, locale, ip string) error
}
```

Update `NewAuthHandler` signature and constructor to accept and assign `legalRepo`.

- [ ] **Step 2: Add `system_role` to `issueTokens`**

Update the `issueTokens` helper so `UserClaims` includes `SystemRole`:

```go
func (h *AuthHandler) issueTokens(ctx context.Context, user *domain.User, tenantID string) (domain.TokenPair, *domain.UserClaims, error) {
	perms, err := h.rbacRepo.GetPermissionsForUser(ctx, user.ID, tenantID)
	if err != nil {
		return domain.TokenPair{}, nil, err
	}
	claims := domain.UserClaims{
		UserID:      user.ID,
		UserName:    user.Name,
		TenantID:    tenantID,
		Permissions: perms,
		SystemRole:  user.SystemRole,
	}
	pair, err := h.jwtSvc.IssueTokenPair(claims)
	if err != nil {
		return domain.TokenPair{}, nil, err
	}
	return pair, &claims, nil
}
```

Also update `issueBootstrapToken` to include `SystemRole`:

```go
func (h *AuthHandler) issueBootstrapToken(user *domain.User) (domain.TokenPair, error) {
	pair, err := h.jwtSvc.IssueTokenPair(domain.UserClaims{
		UserID:      user.ID,
		SystemRole:  user.SystemRole,
		TenantID:    "",
		Permissions: []string{"create:tenant", "view-any:tenant"},
	})
	return pair, err
}
```

- [ ] **Step 3: Add `pendingTerms` helper**

Add a private method that returns the pending terms payload if the user has not accepted the latest version, or nil if they have:

```go
type pendingTermsPayload struct {
	VersionID string              `json:"version_id"`
	Version   int                 `json:"version"`
	Locale    string              `json:"locale"`
	Blocks    []domain.TermBlock  `json:"blocks"`
}

func (h *AuthHandler) buildPendingTerms(ctx context.Context, userID, locale string) *pendingTermsPayload {
	latest, err := h.legalRepo.GetLatestVersion(ctx)
	if err != nil || latest == nil {
		return nil
	}
	accepted, err := h.legalRepo.HasUserAccepted(ctx, userID, latest.ID)
	if err != nil || accepted {
		return nil
	}
	blocks, resolvedLocale := latest.ResolveBlocks(locale)
	return &pendingTermsPayload{
		VersionID: latest.ID,
		Version:   latest.Version,
		Locale:    resolvedLocale,
		Blocks:    blocks,
	}
}
```

- [ ] **Step 4: Append `pending_terms` to Login and Refresh responses**

In `Login`, after building the response map, add:

```go
if pt := h.buildPendingTerms(r.Context(), user.ID, user.Locale); pt != nil {
    // append to the existing response map before JSON(w, ...)
    responseMap["pending_terms"] = pt
}
```

Do the same in `Refresh` — in both the bootstrap path and the normal token path.

- [ ] **Step 5: Add `AcceptTerms` handler**

```go
func (h *AuthHandler) AcceptTerms(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())
	if claims == nil {
		Unauthorized(w)
		return
	}

	var req struct {
		VersionID string `json:"version_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.VersionID == "" {
		UnprocessableEntity(w, "version_id is required")
		return
	}

	ip := r.Header.Get("X-Real-IP")
	if ip == "" {
		ip = r.RemoteAddr
	}

	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil {
		Unauthorized(w)
		return
	}

	if err := h.legalRepo.RecordAcceptance(r.Context(), claims.UserID, req.VersionID, user.Locale, ip); err != nil {
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 6: Verify compilation**

```bash
cd backend && go build ./internal/api/...
```

Expected: compile error that `NewAuthHandler` call in `main.go` is missing args — will be fixed in Task 11.

- [ ] **Step 7: Commit**

```bash
git add backend/internal/api/auth.go
git commit -m "feat: embed system_role in JWT and add pending_terms + AcceptTerms to auth"
```

---

## Task 10: Legal API handler

**Files:**
- Create: `backend/internal/api/legal.go`

- [ ] **Step 1: Write the handler**

```go
package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/middleware"
)

type LegalHandler struct {
	repo interface {
		GetLatestVersion(ctx context.Context) (*domain.LegalTermVersion, error)
		GetVersionByID(ctx context.Context, id string) (*domain.LegalTermVersion, error)
		ListVersions(ctx context.Context) ([]domain.LegalTermVersion, error)
		CreateVersion(ctx context.Context, v *domain.LegalTermVersion) error
		UpdateVersion(ctx context.Context, v *domain.LegalTermVersion) error
	}
}

func NewLegalHandler(repo interface {
	GetLatestVersion(ctx context.Context) (*domain.LegalTermVersion, error)
	GetVersionByID(ctx context.Context, id string) (*domain.LegalTermVersion, error)
	ListVersions(ctx context.Context) ([]domain.LegalTermVersion, error)
	CreateVersion(ctx context.Context, v *domain.LegalTermVersion) error
	UpdateVersion(ctx context.Context, v *domain.LegalTermVersion) error
}) *LegalHandler {
	return &LegalHandler{repo: repo}
}

type legalVersionResponse struct {
	ID             string                       `json:"id"`
	Version        int                          `json:"version"`
	FallbackLocale string                       `json:"fallback_locale"`
	Translations   map[string][]domain.TermBlock `json:"translations"`
	EffectiveAt    time.Time                    `json:"effective_at"`
	CreatedAt      time.Time                    `json:"created_at"`
}

func toLegalVersionResponse(v domain.LegalTermVersion) legalVersionResponse {
	return legalVersionResponse{
		ID:             v.ID,
		Version:        v.Version,
		FallbackLocale: v.FallbackLocale,
		Translations:   v.Translations,
		EffectiveAt:    v.EffectiveAt,
		CreatedAt:      v.CreatedAt,
	}
}

func (h *LegalHandler) List(w http.ResponseWriter, r *http.Request) {
	versions, err := h.repo.ListVersions(r.Context())
	if err != nil {
		InternalError(w)
		return
	}
	data := make([]legalVersionResponse, len(versions))
	for i, v := range versions {
		data[i] = toLegalVersionResponse(v)
	}
	JSON(w, http.StatusOK, map[string]any{"data": data})
}

func (h *LegalHandler) Get(w http.ResponseWriter, r *http.Request) {
	v, err := h.repo.GetVersionByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"data": toLegalVersionResponse(*v)})
}

func (h *LegalHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserClaimsFromContext(r.Context())

	var req struct {
		FallbackLocale string                       `json:"fallback_locale"`
		Translations   map[string][]domain.TermBlock `json:"translations"`
		EffectiveAt    time.Time                    `json:"effective_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if len(req.Translations) == 0 {
		UnprocessableEntity(w, "translations required")
		return
	}
	if req.FallbackLocale == "" {
		req.FallbackLocale = "en"
	}

	v := &domain.LegalTermVersion{
		ID:             domain.NewID(),
		FallbackLocale: req.FallbackLocale,
		Translations:   req.Translations,
		EffectiveAt:    req.EffectiveAt,
		CreatedBy:      &claims.UserID,
	}
	if err := h.repo.CreateVersion(r.Context(), v); err != nil {
		InternalError(w)
		return
	}
	JSON(w, http.StatusCreated, map[string]any{"data": toLegalVersionResponse(*v)})
}

func (h *LegalHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	existing, err := h.repo.GetVersionByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	var req struct {
		FallbackLocale string                       `json:"fallback_locale"`
		Translations   map[string][]domain.TermBlock `json:"translations"`
		EffectiveAt    *time.Time                   `json:"effective_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.FallbackLocale != "" {
		existing.FallbackLocale = req.FallbackLocale
	}
	if req.Translations != nil {
		existing.Translations = req.Translations
	}
	if req.EffectiveAt != nil {
		existing.EffectiveAt = *req.EffectiveAt
	}

	if err := h.repo.UpdateVersion(r.Context(), existing); err != nil {
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd backend && go build ./internal/api/...
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/api/legal.go
git commit -m "feat: LegalHandler CRUD for versioned terms"
```

---

## Task 11: Users API — SetSystemRole endpoint

**Files:**
- Modify: `backend/internal/api/admin_users.go`

- [ ] **Step 1: Add `SetSystemRole` to the userRepo interface and handler**

Find the `AdminUsersHandler` struct and its `userRepo` interface. Add `SetSystemRole(ctx context.Context, userID, role string) error` to the interface.

Add the handler method:

```go
func (h *AdminUsersHandler) SetSystemRole(w http.ResponseWriter, r *http.Request) {
	callerClaims := middleware.UserClaimsFromContext(r.Context())
	targetID := chi.URLParam(r, "id")

	if callerClaims.UserID == targetID {
		Error(w, http.StatusUnprocessableEntity, "cannot change your own system role")
		return
	}

	var req struct {
		SystemRole string `json:"system_role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		UnprocessableEntity(w, "invalid request body")
		return
	}
	if req.SystemRole != "user" && req.SystemRole != "platform_admin" {
		UnprocessableEntity(w, "system_role must be 'user' or 'platform_admin'")
		return
	}

	if err := h.userRepo.SetSystemRole(r.Context(), targetID, req.SystemRole); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd backend && go build ./internal/api/...
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/api/admin_users.go
git commit -m "feat: SetSystemRole endpoint on AdminUsersHandler"
```

---

## Task 12: Wire everything in `main.go`

**Files:**
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Instantiate repositories and handlers**

After `mcpApiKeyRepo` line, add:

```go
legalRepo := repository.NewLegalRepository(pool)
```

Update `NewAuthHandler` call to pass `legalRepo` as the last argument (after `secureCookies`).

Add:

```go
legalHandler := api.NewLegalHandler(legalRepo)
```

- [ ] **Step 2: Register legal routes (inside the timeout group, after audit routes)**

```go
// legal terms — platform admin only
r.Route("/admin/legal", func(r chi.Router) {
    r.Use(middleware.AdminCORS(cfg.AdminCORSOrigins))
    r.Use(middleware.AuthenticateAdmin(jwtSvc))
    r.Use(middleware.RequireSystemRole("platform_admin"))
    r.Get("/versions", legalHandler.List)
    r.Post("/versions", legalHandler.Create)
    r.Get("/versions/{id}", legalHandler.Get)
    r.Put("/versions/{id}", legalHandler.Update)
})
```

- [ ] **Step 3: Register AcceptTerms route (inside auth group)**

Inside `r.Route("/auth", ...)`, in the authenticated group:

```go
r.Post("/accept-terms", authHandler.AcceptTerms)
```

- [ ] **Step 4: Register SetSystemRole route**

Inside `r.Route("/admin", ...)`:

```go
r.With(middleware.RequireSystemRole("platform_admin")).
    Put("/users/{id}/system-role", usersHandler.SetSystemRole)
```

- [ ] **Step 5: Protect integrations routes with `RequireSystemRole`**

Find the six integrations routes and replace `middleware.RequirePermission("manage:integrations")` and `middleware.RequirePermission("view:integrations")` with `middleware.RequireSystemRole("platform_admin")`:

```go
r.With(middleware.RequireSystemRole("platform_admin")).Get("/integrations", integrationsHandler.List)
r.With(middleware.RequireSystemRole("platform_admin")).Get("/integrations/providers", integrationsHandler.ListProviders)
r.With(middleware.RequireSystemRole("platform_admin")).Post("/integrations", integrationsHandler.Create)
r.With(middleware.RequireSystemRole("platform_admin")).Get("/integrations/{id}", integrationsHandler.Get)
r.With(middleware.RequireSystemRole("platform_admin")).Put("/integrations/{id}", integrationsHandler.Update)
r.With(middleware.RequireSystemRole("platform_admin")).Delete("/integrations/{id}", integrationsHandler.Delete)
r.With(middleware.RequireSystemRole("platform_admin")).Post("/integrations/{id}/test", integrationsHandler.Test)
r.With(middleware.RequireSystemRole("platform_admin")).Put("/integrations/{id}/tenants", integrationsHandler.SetTenants)
```

- [ ] **Step 6: Build and verify**

```bash
cd backend && go build ./...
```

Expected: no errors.

- [ ] **Step 7: Smoke test**

```bash
cd backend && go run ./cmd/server &
curl -s http://localhost:8080/health | jq .
kill %1
```

- [ ] **Step 8: Commit**

```bash
git add backend/cmd/server/main.go
git commit -m "feat: wire legal routes, AcceptTerms, SetSystemRole and integrations platform guard"
```

---

## Task 13: Frontend — i18n keys

**Files:**
- Modify: `frontend/locales/en/settings.json`
- Modify: `frontend/locales/pt-BR/settings.json`

- [ ] **Step 1: Add keys to `en/settings.json`**

Open `frontend/locales/en/settings.json` and add:

```json
"settings:nav_legal": "Legal",
"terms:update_title": "Terms Update",
"terms:agree_checkbox": "I have read and agree to the terms above",
"terms:continue": "Continue",
"terms:logout": "Log out instead"
```

- [ ] **Step 2: Add keys to `pt-BR/settings.json`**

```json
"settings:nav_legal": "Legal",
"terms:update_title": "Atualização dos Termos",
"terms:agree_checkbox": "Li e concordo com os termos acima",
"terms:continue": "Continuar",
"terms:logout": "Sair em vez disso"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/locales/
git commit -m "feat: i18n keys for legal terms and settings nav"
```

---

## Task 14: Frontend — extend auth store

**Files:**
- Modify: `frontend/src/lib/stores/auth.svelte.ts`

- [ ] **Step 1: Replace the full file with updated version**

```ts
import { setToken, clearToken, getToken, doRefresh, apiFetch } from '$lib/api/client'
import { localeStore } from '$lib/stores/locale.svelte'

export interface AuthUser {
  id: string
  name: string
  email: string
  tenant_id: string
  permissions: string[]
  locale: string
  timezone?: string
  system_role: 'user' | 'platform_admin'
}

export interface PendingTerms {
  version_id: string
  version: number
  locale: string
  blocks: { title: string; content: string }[]
}

interface CachedSession {
  user: AuthUser
  token: string
  expiresAt: number
  pendingTerms: PendingTerms | null
}

const SESSION_KEY = 'mkt_session'

function loadSession(): CachedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as CachedSession) : null
  } catch {
    return null
  }
}

function saveSession(user: AuthUser, token: string, expiresAt: number, pendingTerms: PendingTerms | null) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, token, expiresAt, pendingTerms }))
  } catch {}
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {}
}

let _token = $state<string | null>(null)
let _user = $state<AuthUser | null>(null)
let _pendingTerms = $state<PendingTerms | null>(null)

function applyRefreshData(data: Record<string, unknown>) {
  const userBase = (data['user'] ?? {}) as Record<string, unknown>
  _user = {
    ...userBase,
    tenant_id: (data['tenant_id'] ?? userBase['tenant_id'] ?? '') as string,
    permissions: ((data['permissions'] ?? userBase['permissions']) as string[]) ?? [],
    system_role: ((data['system_role'] ?? userBase['system_role'] ?? 'user') as 'user' | 'platform_admin')
  } as AuthUser
  _token = getToken()
  _pendingTerms = (data['pending_terms'] as PendingTerms | null) ?? null
  const raw = data['expires_at']
  const expiresAt = raw ? new Date(raw as string).getTime() : Date.now() + 14 * 60 * 1000
  saveSession(_user, _token!, expiresAt, _pendingTerms)
  if (_user?.locale) localeStore.init(_user.locale)
}

export const auth = {
  get token() { return _token },
  get user() { return _user },
  get isAuthenticated() { return _token !== null },
  get pendingTerms() { return _pendingTerms },

  setToken(t: string) {
    _token = t
    setToken(t)
  },

  setUser(u: AuthUser) {
    _user = u
    if (_token) saveSession(u, _token, Date.now() + 14 * 60 * 1000, _pendingTerms)
  },

  clear() {
    _token = null
    _user = null
    _pendingTerms = null
    clearToken()
    clearSession()
  },

  async acceptTerms(versionId: string): Promise<void> {
    await apiFetch('/auth/accept-terms', {
      method: 'POST',
      body: JSON.stringify({ version_id: versionId })
    })
    _pendingTerms = null
    if (_user && _token) {
      saveSession(_user, _token, Date.now() + 14 * 60 * 1000, null)
    }
  },

  async restoreSession(): Promise<boolean> {
    const cached = loadSession()

    if (cached && cached.expiresAt > Date.now()) {
      setToken(cached.token)
      _token = cached.token
      _user = cached.user
      _pendingTerms = cached.pendingTerms ?? null
      if (_user?.locale) localeStore.init(_user.locale)

      doRefresh()
        .then((data) => {
          if (data) applyRefreshData(data)
          else auth.clear()
        })
        .catch(() => {})

      return true
    }

    const data = await doRefresh()
    if (!data) return false
    applyRefreshData(data)
    return true
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/stores/auth.svelte.ts
git commit -m "feat: add system_role, pendingTerms and acceptTerms to auth store"
```

---

## Task 15: Frontend — Terms Wall component

**Files:**
- Create: `frontend/src/lib/components/ui/terms-wall/terms-wall.svelte`

- [ ] **Step 1: Check existing components for overlap**

```bash
ls frontend/src/lib/components/ui/
```

Look for: `dialog`, `sheet`, `drawer`. We want a full-screen overlay — if none fit, build with Bits UI `Dialog.Root` in non-dismissable mode (no close button, no overlay click-to-close).

- [ ] **Step 2: Create the component**

```svelte
<script lang="ts">
  import { auth, type PendingTerms } from '$lib/stores/auth.svelte'
  import { goto } from '$app/navigation'
  import { m } from '$lib/paraglide/messages'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Checkbox } from '$lib/components/ui/checkbox/index.js'

  let { terms }: { terms: PendingTerms } = $props()

  let agreed = $state(false)
  let loading = $state(false)

  async function handleAccept() {
    if (!agreed) return
    loading = true
    try {
      await auth.acceptTerms(terms.version_id)
    } finally {
      loading = false
    }
  }

  function handleLogout() {
    auth.clear()
    goto('/login')
  }
</script>

<div class="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950">
  <div class="flex flex-1 flex-col overflow-hidden">
    <header class="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">
        {m['terms:update_title']()}
      </h1>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6">
      <div class="mx-auto max-w-3xl space-y-8">
        {#each terms.blocks as block (block.title)}
          <section>
            <h2 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
              {block.title}
            </h2>
            <p class="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {block.content}
            </p>
          </section>
        {/each}
      </div>
    </div>

    <footer class="border-t border-slate-200 px-6 py-4 dark:border-slate-800">
      <div class="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label class="flex cursor-pointer items-center gap-3">
          <Checkbox bind:checked={agreed} />
          <span class="text-sm text-slate-700 dark:text-slate-300">
            {m['terms:agree_checkbox']()}
          </span>
        </label>
        <div class="flex items-center gap-3">
          <button
            onclick={handleLogout}
            class="text-sm text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {m['terms:logout']()}
          </button>
          <Button onclick={handleAccept} disabled={!agreed || loading}>
            {m['terms:continue']()}
          </Button>
        </div>
      </div>
    </footer>
  </div>
</div>
```

> If `Checkbox` does not exist in `components/ui`, install it from Bits UI: `npx shadcn-svelte@latest add checkbox` or use Bits UI directly: `import { Checkbox } from 'bits-ui'`.

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/components/ui/terms-wall/
git commit -m "feat: TermsWall full-screen acceptance component"
```

---

## Task 16: Frontend — root layout guard

**Files:**
- Modify: `frontend/src/routes/+layout.svelte`

- [ ] **Step 1: Read the current layout**

Read `frontend/src/routes/+layout.svelte` to see the current structure before editing.

- [ ] **Step 2: Add terms wall guard**

Import `TermsWall` and `auth`, then wrap `{@render children()}` conditionally. The terms wall replaces all children when `auth.pendingTerms` is non-null and the user is authenticated:

```svelte
<script lang="ts">
  // ...existing imports...
  import { auth } from '$lib/stores/auth.svelte'
  import TermsWall from '$lib/components/ui/terms-wall/terms-wall.svelte'
  // ...rest of existing script...
</script>

<!-- existing layout markup -->
{#if auth.isAuthenticated && auth.pendingTerms}
  <TermsWall terms={auth.pendingTerms} />
{:else}
  {@render children()}
{/if}
```

Preserve all existing elements (theme provider, toaster, etc.) outside the conditional.

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/+layout.svelte
git commit -m "feat: block navigation with terms wall when pending_terms is set"
```

---

## Task 17: Frontend — Legal API client

**Files:**
- Create: `frontend/src/lib/api/legal.ts`

- [ ] **Step 1: Write the API module**

```ts
import { apiFetch, apiFetchData } from '$lib/api/client'
import type { PendingTerms } from '$lib/stores/auth.svelte'

export interface LegalBlock {
  title: string
  content: string
}

export interface LegalVersion {
  id: string
  version: number
  fallback_locale: string
  translations: Record<string, LegalBlock[]>
  effective_at: string
  created_at: string
}

export const getLegalVersions = (fetch: typeof globalThis.fetch) =>
  apiFetchData<LegalVersion[]>('/admin/legal/versions', {}, fetch)

export const getLegalVersion = (fetch: typeof globalThis.fetch, id: string) =>
  apiFetchData<LegalVersion>(`/admin/legal/versions/${id}`, {}, fetch)

export const createLegalVersion = (body: {
  fallback_locale: string
  translations: Record<string, LegalBlock[]>
  effective_at: string
}) => apiFetchData<LegalVersion>('/admin/legal/versions', { method: 'POST', body: JSON.stringify(body) })

export const updateLegalVersion = (
  id: string,
  body: Partial<{ fallback_locale: string; translations: Record<string, LegalBlock[]>; effective_at: string }>
) => apiFetch<void>(`/admin/legal/versions/${id}`, { method: 'PUT', body: JSON.stringify(body) })

export const setUserSystemRole = (userId: string, systemRole: 'user' | 'platform_admin') =>
  apiFetch<void>(`/admin/users/${userId}/system-role`, {
    method: 'PUT',
    body: JSON.stringify({ system_role: systemRole })
  })
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api/legal.ts
git commit -m "feat: legal API client and setUserSystemRole"
```

---

## Task 18: Frontend — `/settings/legal` route

**Files:**
- Create: `frontend/src/routes/settings/legal/+page.ts`
- Create: `frontend/src/routes/settings/legal/+page.svelte`

- [ ] **Step 1: Write `+page.ts`**

```ts
import { redirect } from '@sveltejs/kit'
import { auth } from '$lib/stores/auth.svelte'
import { getLegalVersions } from '$lib/api/legal'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ fetch }) => {
  if (auth.user?.system_role !== 'platform_admin') redirect(302, '/')
  return {
    versions: withFallback(getLegalVersions(fetch), [])
  }
}
```

- [ ] **Step 2: Write `+page.svelte`**

```svelte
<script lang="ts">
  import type { PageData } from './$types'
  import type { LegalVersion, LegalBlock } from '$lib/api/legal'
  import { createLegalVersion, updateLegalVersion } from '$lib/api/legal'
  import { auth } from '$lib/stores/auth.svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Textarea } from '$lib/components/ui/textarea/index.js'
  import SectionTitle from '$lib/components/ui/title/section-title.svelte'
  import * as Select from '$lib/components/ui/select'
  import { toast } from 'svelte-sonner'
  import { Plus, Trash2 } from 'lucide-svelte'

  let { data } = $props<{ data: PageData }>()

  let versions = $state<LegalVersion[]>([])
  let selected = $state<LegalVersion | null>(null)
  let isNew = $state(false)

  // Editable form state
  let fallbackLocale = $state('en')
  let effectiveAt = $state('')
  let translations = $state<Record<string, LegalBlock[]>>({})
  let locales = $derived(Object.keys(translations))

  $effect(() => {
    Promise.resolve(data.versions).then((v) => {
      versions = v
    })
  })

  function selectVersion(v: LegalVersion) {
    selected = v
    isNew = false
    fallbackLocale = v.fallback_locale
    effectiveAt = v.effective_at.slice(0, 16) // datetime-local format
    translations = structuredClone(v.translations)
  }

  function startNew() {
    selected = null
    isNew = true
    fallbackLocale = 'en'
    effectiveAt = new Date().toISOString().slice(0, 16)
    translations = { en: [{ title: '', content: '' }] }
  }

  function addLocale() {
    const locale = prompt('Locale code (e.g. fr, de, es):')
    if (locale && !translations[locale]) {
      translations = { ...translations, [locale]: [{ title: '', content: '' }] }
    }
  }

  function removeLocale(locale: string) {
    const { [locale]: _, ...rest } = translations
    translations = rest
  }

  function addBlock(locale: string) {
    translations = {
      ...translations,
      [locale]: [...translations[locale], { title: '', content: '' }]
    }
  }

  function removeBlock(locale: string, index: number) {
    translations = {
      ...translations,
      [locale]: translations[locale].filter((_, i) => i !== index)
    }
  }

  async function save() {
    const body = {
      fallback_locale: fallbackLocale,
      translations,
      effective_at: new Date(effectiveAt).toISOString()
    }
    try {
      if (isNew) {
        const created = await createLegalVersion(body)
        versions = [created, ...versions]
        selectVersion(created)
        isNew = false
        toast.success('Version created')
      } else if (selected) {
        await updateLegalVersion(selected.id, body)
        versions = versions.map((v) =>
          v.id === selected!.id ? { ...v, ...body } : v
        )
        toast.success('Version updated')
      }
    } catch {
      toast.error('Failed to save')
    }
  }
</script>

<div class="flex min-h-0 flex-1">
  <!-- Left: version list -->
  <aside class="flex w-64 flex-col gap-2 overflow-y-auto border-r border-slate-200 p-4 dark:border-slate-800">
    <div class="flex items-center justify-between">
      <SectionTitle>Versions</SectionTitle>
      <Button size="sm" variant="ghost" onclick={startNew}>
        <Plus class="h-4 w-4" />
      </Button>
    </div>
    {#each versions as v (v.id)}
      <button
        onclick={() => selectVersion(v)}
        class="rounded-md px-3 py-2 text-left text-sm transition-colors {selected?.id === v.id
          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
      >
        <div class="font-medium">v{v.version}</div>
        <div class="text-xs text-slate-500">{new Date(v.effective_at).toLocaleDateString()}</div>
      </button>
    {/each}
  </aside>

  <!-- Right: editor -->
  <main class="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
    {#if isNew || selected}
      <div class="flex items-center justify-between">
        <SectionTitle>{isNew ? 'New Version' : `Edit v${selected?.version}`}</SectionTitle>
        <Button onclick={save}>Save</Button>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-400">Fallback Locale</label>
          <Input bind:value={fallbackLocale} placeholder="en" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-400">Effective At</label>
          <input
            type="datetime-local"
            bind:value={effectiveAt}
            class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      <!-- Translations per locale -->
      <div class="flex flex-col gap-6">
        {#each locales as locale (locale)}
          <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <div class="mb-3 flex items-center justify-between">
              <span class="text-sm font-semibold text-slate-800 dark:text-slate-200">{locale}</span>
              <button
                onclick={() => removeLocale(locale)}
                class="text-slate-400 hover:text-red-500"
                title="Remove locale"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>

            {#each translations[locale] as block, i (i)}
              <div class="mb-4 flex flex-col gap-2 rounded-md bg-slate-50 p-3 dark:bg-slate-800/50">
                <div class="flex items-center justify-between">
                  <span class="text-xs text-slate-500">Block {i + 1}</span>
                  <button onclick={() => removeBlock(locale, i)} class="text-slate-400 hover:text-red-500">
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  bind:value={translations[locale][i].title}
                  placeholder="Title"
                />
                <Textarea
                  bind:value={translations[locale][i].content}
                  placeholder="Content (plain text or markdown)"
                  rows={4}
                />
              </div>
            {/each}

            <Button size="sm" variant="outline" onclick={() => addBlock(locale)}>
              <Plus class="mr-1 h-3.5 w-3.5" /> Add Block
            </Button>
          </div>
        {/each}

        <Button variant="outline" onclick={addLocale}>
          <Plus class="mr-1 h-4 w-4" /> Add Locale
        </Button>
      </div>
    {:else}
      <p class="text-sm text-slate-500">Select a version or create a new one.</p>
    {/if}
  </main>
</div>
```

> If `Textarea` doesn't exist in `components/ui`, check — it likely does since most shadcn-svelte installs include it. If not: `npx shadcn-svelte@latest add textarea`.

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/settings/legal/
git commit -m "feat: /settings/legal management UI for versioned terms"
```

---

## Task 19: Frontend — update `/settings/` layout and integrations guard

**Files:**
- Modify: `frontend/src/routes/settings/+layout.svelte`
- Modify: `frontend/src/routes/settings/+page.ts`
- Modify: `frontend/src/routes/settings/integrations/+page.ts`

- [ ] **Step 1: Add Legal nav link to `settings/+layout.svelte`**

Open `frontend/src/routes/settings/+layout.svelte`. The current layout has one `SubToolbarLink` for integrations. Import `auth` and `FileText` from lucide, then add Legal link conditionally:

```svelte
<script lang="ts">
  // ...existing imports...
  import { FileText } from 'lucide-svelte'
  import { auth } from '$lib/stores/auth.svelte'
  import { m } from '$lib/paraglide/messages'
  // ...
</script>

<!-- inside SubToolbar, after existing integrations link: -->
{#if auth.user?.system_role === 'platform_admin'}
  <SubToolbarLink
    href="/settings/legal"
    label={m['settings:nav_legal']()}
    icon={FileText}
    active={currentPath.includes('/legal')}
  />
{/if}
```

- [ ] **Step 2: Add guard to `settings/+page.ts`**

```ts
import { redirect } from '@sveltejs/kit'
import { auth } from '$lib/stores/auth.svelte'
import type { PageLoad } from './$types'

export const load: PageLoad = () => {
  if (!auth.user || auth.user.system_role !== 'platform_admin') redirect(302, '/')
  redirect(302, '/settings/integrations')
}
```

- [ ] **Step 3: Add guard to `integrations/+page.ts`**

Open `frontend/src/routes/settings/integrations/+page.ts`. Add guard before the existing load logic:

```ts
import { redirect } from '@sveltejs/kit'
import { auth } from '$lib/stores/auth.svelte'
// ...existing imports...

export const load: PageLoad = ({ fetch }) => {
  if (auth.user?.system_role !== 'platform_admin') redirect(302, '/')
  return {
    data: withFallback(getIntegrations(fetch), { integrations: [], providers: [] }),
    tenants: withFallback(getTenants(fetch), [])
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/settings/
git commit -m "feat: platform_admin guard on /settings/ routes and Legal nav link"
```

---

## Task 20: Frontend — system_role toggle in Users settings

**Files:**
- Modify: `frontend/src/routes/[tenant]/settings/users/+page.svelte`

- [ ] **Step 1: Add system-role toggle**

Import `setUserSystemRole` from `$lib/api/legal`. In the users table, find where each user row is rendered (look for the `editUser` or action column section). Add a "Platform Admin" badge/toggle visible only when `auth.user?.system_role === 'platform_admin'` and `user.id !== currentUserId`.

Add state and handler:

```ts
import { setUserSystemRole } from '$lib/api/legal'
import type { AdminUser } from '$lib/api/admin-users'

let showSystemRoleDialog = $state(false)
let systemRoleTarget = $state<AdminUser | null>(null)

async function handleSetSystemRole(user: AdminUser, role: 'user' | 'platform_admin') {
  try {
    await setUserSystemRole(user.id, role)
    // Update local state optimistically
    users = users.map((u) =>
      u.id === user.id ? { ...u, system_role: role } : u
    )
    toast.success(role === 'platform_admin' ? 'Platform Admin granted' : 'Platform Admin revoked')
  } catch {
    toast.error('Failed to update system role')
  }
}
```

Add `system_role?: 'user' | 'platform_admin'` to the `AdminUser` type in `$lib/api/admin-users.ts` (if not already there — add it to the interface).

In the user row actions (where edit/deactivate buttons are), add conditionally:

```svelte
{#if auth.user?.system_role === 'platform_admin' && user.id !== currentUserId}
  <ConfirmDialog
    title={user.system_role === 'platform_admin' ? 'Revoke Platform Admin' : 'Grant Platform Admin'}
    description={user.system_role === 'platform_admin'
      ? `Remove platform admin access from ${user.name}?`
      : `Grant platform admin access to ${user.name}? They will be able to manage integrations and legal terms.`}
    onConfirm={() => handleSetSystemRole(user, user.system_role === 'platform_admin' ? 'user' : 'platform_admin')}
  >
    {#snippet trigger()}
      <Button size="sm" variant="outline">
        {user.system_role === 'platform_admin' ? 'Revoke Admin' : 'Make Platform Admin'}
      </Button>
    {/snippet}
  </ConfirmDialog>
{/if}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/[tenant]/settings/users/+page.svelte frontend/src/lib/api/admin-users.ts
git commit -m "feat: system_role toggle in users settings (platform_admin only)"
```

---

## Task 21: End-to-end verification

- [ ] **Step 1: Start both servers**

```bash
cd backend && go run ./cmd/server &
cd frontend && npm run dev &
```

- [ ] **Step 2: Verify terms wall on first login**

1. Log in as any existing user — backend returns `pending_terms` (they've never accepted v1).
2. Confirm terms wall blocks the UI.
3. Check the checkbox and click Continue.
4. Confirm the wall disappears and the app loads normally.
5. Refresh — confirm terms wall does NOT reappear (acceptance is persisted).

- [ ] **Step 3: Verify `/settings/integrations` guard**

1. Log in as a non-platform-admin user.
2. Navigate to `/settings/integrations` — confirm redirect to `/`.
3. Log in as a platform_admin user — confirm integrations page loads.

- [ ] **Step 4: Verify platform_admin promotion**

1. Log in as a platform_admin.
2. Go to `/[tenant]/settings/users`.
3. Confirm "Make Platform Admin" button appears on other users.
4. Promote a user — confirm they can now access `/settings/integrations`.

- [ ] **Step 5: Verify `/settings/legal`**

1. Log in as platform_admin.
2. Navigate to `/settings/legal`.
3. Confirm v1 appears in the list.
4. Edit translations and save — confirm no error.
5. Create v2 with a new block — confirm all users see the wall again on next login.

- [ ] **Step 6: Kill dev servers**

```bash
kill $(lsof -t -i:8080) $(lsof -t -i:5173) 2>/dev/null
```

- [ ] **Step 7: Final commit tag**

```bash
git tag v-legal-terms-$(date +%Y%m%d)
```
