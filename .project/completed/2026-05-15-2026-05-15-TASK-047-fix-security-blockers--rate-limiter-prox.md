---
title: "fix: security blockers — rate limiter proxy awareness, key validation, tenant isolation"
created: 2026-05-15T14:00:55.016Z
priority: P1-S
status: backlog
tags: [fix]
---

# fix: security blockers — rate limiter proxy awareness, key validation, tenant isolation

## Context

A full quality review identified 4 production-blocking issues that can all be fixed in the config/middleware layer without touching the database or domain. Fix all 4 in a single PR.

> **Important:** Do NOT use Superpowers skills, brainstorming flows, or any skill beyond the project's built-in Go/Svelte skills. Use only MCP tools, project skills, and direct tool calls.

---

## Fix 1 — Rate limiter reads `RemoteAddr`, bypassed behind proxy

**File:** `backend/internal/middleware/rate_limit.go:63`

**Problem:** `net.SplitHostPort(r.RemoteAddr)` always returns the reverse-proxy IP in production. Every client shares one rate-limit bucket → protection is useless.

**Fix:** Read the real client IP by checking `X-Real-IP` first, then `X-Forwarded-For` (first entry), falling back to `RemoteAddr`. Add a helper `realIP(r *http.Request) string` inside the file:

```go
func realIP(r *http.Request) string {
    if v := r.Header.Get("X-Real-IP"); v != "" {
        return v
    }
    if v := r.Header.Get("X-Forwarded-For"); v != "" {
        // Take only the first (client) address
        if i := strings.Index(v, ","); i != -1 {
            return strings.TrimSpace(v[:i])
        }
        return strings.TrimSpace(v)
    }
    ip, _, _ := net.SplitHostPort(r.RemoteAddr)
    return ip
}
```

Replace the `net.SplitHostPort(r.RemoteAddr)` call in `RateLimitLogin` with `realIP(r)`.

Add `"strings"` to the import block.

---

## Fix 2 — `CREDENTIAL_ENCRYPTION_KEY` not validated at startup

**File:** `backend/internal/config/config.go`

**Problem:** AES-256 requires exactly 16, 24, or 32 bytes. If the key is the wrong length, `aes.NewCipher` panics or errors at the first integration create/update — not at boot. If the env var is absent, credentials are silently stored in plaintext.

**Fix:** After the existing `MCPAPIKey` check, add:

```go
if cfg.CredentialKey != "" {
    n := len(cfg.CredentialKey)
    if n != 16 && n != 24 && n != 32 {
        return nil, fmt.Errorf("CREDENTIAL_ENCRYPTION_KEY must be 16, 24, or 32 bytes (got %d)", n)
    }
}
if cfg.AppEnv == "production" && cfg.CredentialKey == "" {
    return nil, fmt.Errorf("CREDENTIAL_ENCRYPTION_KEY is required in production")
}
```

---

## Fix 3 — Two routes missing `RequireTenantMatch`

**File:** `backend/cmd/server/main.go:316-326`

**Problem:** These two standalone route groups bypass the tenant-isolation middleware that protects all other `/admin/tenants/{tenantId}/*` routes. Any authenticated user can call them with an arbitrary tenant ID.

```go
r.Route("/admin/tenants/{tenantId}/ai", ...)          // missing RequireTenantMatch
r.Route("/admin/tenants/{tenantId}/google-ads", ...)  // missing RequireTenantMatch
```

**Fix:** Add `r.Use(middleware.RequireTenantMatch)` inside each of those route closures, alongside the existing `AdminCORS` and `AuthenticateAdmin` middleware:

```go
r.Route("/admin/tenants/{tenantId}/ai", func(r chi.Router) {
    r.Use(middleware.AdminCORS(cfg.AdminCORSOrigins))
    r.Use(middleware.AuthenticateAdmin(jwtSvc))
    r.Use(middleware.RequireTenantMatch)   // ← add
    r.Get("/providers", aiGenerateHandler.ListProviders)
})

r.Route("/admin/tenants/{tenantId}/google-ads", func(r chi.Router) {
    r.Use(middleware.AdminCORS(cfg.AdminCORSOrigins))
    r.Use(middleware.AuthenticateAdmin(jwtSvc))
    r.Use(middleware.RequireTenantMatch)   // ← add
    r.Get("/status", googleAdsHandler.Status)
})
```

---

## Fix 4 — Misleading `r.Group` indentation in `main.go`

**File:** `backend/cmd/server/main.go:192-303` and `312-329`

**Problem:** Two `r.Group(func(r chi.Router) { r.Use(chimw.Timeout(...)) ... })` closures have their inner `r.Route(...)` calls at the wrong indentation level. The code is functionally correct but appears to be outside the closure, making it very easy for future developers to accidentally register routes outside the timeout group.

**Fix:** Re-indent every `r.Route`, `r.Get`, and inner `r.Group` call that lives inside each timeout group so they are indented one level deeper than the `r.Group(...)` call itself. No logic changes — indentation only.

---

## Acceptance criteria

- [ ] `go build ./...` passes
- [ ] `go vet ./...` passes
- [ ] Login rate limit test: behind a proxy with `X-Real-IP: 1.2.3.4`, 6 consecutive POST `/auth/login` returns 429 on the 6th
- [ ] Starting the server with `CREDENTIAL_ENCRYPTION_KEY=short` exits with a clear error message
- [ ] Starting in production mode (`APP_ENV=production`) without `CREDENTIAL_ENCRYPTION_KEY` exits with an error
- [ ] Calling `GET /admin/tenants/{other-tenant-id}/ai/providers` with a valid token for a different tenant returns 403


