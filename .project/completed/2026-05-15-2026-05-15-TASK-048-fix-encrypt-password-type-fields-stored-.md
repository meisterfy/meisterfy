---
title: "fix: encrypt password-type fields stored in integration config JSONB"
created: 2026-05-15T14:01:25.360Z
priority: P1-M
status: backlog
tags: [fix]
---

# fix: encrypt password-type fields stored in integration config JSONB

## Context

A quality review found that hardcoded credential fields (`oauth_client_secret`, `developer_token`, `refresh_token`) are correctly encrypted with AES-256-GCM before storage. However, any credential stored in the generic `Config` JSONB column (e.g., `api_key` for OpenAI, Anthropic, Gemini, Groq, Kimi integrations) is saved in **plaintext**.

This happens because `applyFieldToIntegration` in `backend/internal/api/admin_integrations.go` routes non-hardcoded fields to `ig.Config`, and `marshalConfig` / `unmarshalConfig` in `backend/internal/repository/integration.go` performs no encryption.

> **Important:** Do NOT use Superpowers skills or any skill beyond the project's built-in Go/Svelte skills. Use only MCP tools, project skills, and direct tool calls.

---

## Affected files

- `backend/internal/repository/integration.go` — `marshalConfig`, `unmarshalConfig`, `Create`, `Update`, `mapIntegration`
- No schema or migration changes required (the `config` column already exists as JSONB/bytea)

---

## Chosen approach

Encrypt the **entire serialized Config blob** with AES-256-GCM using the same `crypto` package already used for the string credential fields. This is the simplest approach and avoids needing to pass schema knowledge (which fields are passwords) down to the repository layer.

- On write: `json.Marshal(cfg)` → `crypto.Encrypt(key, json)` → store ciphertext string in `config` column
- On read: `crypto.Decrypt(key, ciphertext)` → `json.Unmarshal` → `map[string]any`
- If `key` is empty (no `CREDENTIAL_ENCRYPTION_KEY` set): store/read plain JSON as today (zero-change behaviour for dev environments)
- **Migration safety:** if decryption fails (legacy plaintext row), fall back to treating the raw bytes as plain JSON — same graceful-degradation pattern already used in `decryptSecret`

---

## Implementation

### 1. Replace `marshalConfig` and `unmarshalConfig`

In `backend/internal/repository/integration.go`, replace the two helper functions:

```go
// encryptConfig serializes cfg to JSON and, if a key is set, encrypts the result.
// Returns a JSON byte slice (plain or containing a JSON string with the ciphertext).
func (r *IntegrationRepository) encryptConfig(cfg map[string]any) json.RawMessage {
    if len(cfg) == 0 {
        cfg = map[string]any{}
    }
    plain, _ := json.Marshal(cfg)
    if len(r.key) == 0 {
        return plain
    }
    enc, err := crypto.Encrypt(r.key, string(plain))
    if err != nil {
        return plain // fallback: store unencrypted rather than lose data
    }
    quoted, _ := json.Marshal(enc) // wrap ciphertext as a JSON string
    return quoted
}

// decryptConfig deserializes a config value stored by encryptConfig.
// Handles both the encrypted (JSON-string ciphertext) and legacy plain-JSON formats.
func (r *IntegrationRepository) decryptConfig(raw json.RawMessage) map[string]any {
    if len(raw) == 0 {
        return map[string]any{}
    }
    // Try to decrypt: the encrypted form is a JSON string (starts with '"')
    if len(r.key) > 0 && len(raw) > 2 && raw[0] == '"' {
        var ciphertext string
        if json.Unmarshal(raw, &ciphertext) == nil {
            if plain, err := crypto.Decrypt(r.key, ciphertext); err == nil {
                var out map[string]any
                if json.Unmarshal([]byte(plain), &out) == nil {
                    return out
                }
            }
        }
    }
    // Fallback: treat as plain JSON object (legacy rows or no key set)
    var out map[string]any
    _ = json.Unmarshal(raw, &out)
    if out == nil {
        return map[string]any{}
    }
    return out
}
```

Remove the old `marshalConfig` and `unmarshalConfig` package-level functions.

### 2. Update callers

In `Create` and `Update`, replace:
```go
Config: marshalConfig(ig.Config),
```
with:
```go
Config: r.encryptConfig(ig.Config),
```

In `mapIntegration`, replace:
```go
Config: unmarshalConfig(row.Config),
```
with:
```go
Config: r.decryptConfig(row.Config),
```

### 3. Add `crypto` import if not already present

`"github.com/rush-maestro/rush-maestro/internal/crypto"` — already imported for `encryptSecret`/`decryptSecret`, so no change needed.

---

## Acceptance criteria

- [ ] `go build ./...` passes
- [ ] `go vet ./...` passes
- [ ] With `CREDENTIAL_ENCRYPTION_KEY` set (32-byte key): creating an OpenAI integration and then reading the raw `config` column in PostgreSQL shows a base64 ciphertext, not a plain JSON object containing `api_key`
- [ ] With the key set: reading back the integration via the API returns the correct (decrypted) `api_key` value (masked as `***` in the response, but decryptable in the service layer)
- [ ] Without `CREDENTIAL_ENCRYPTION_KEY`: existing behaviour is preserved — plain JSON stored and read without error
- [ ] Existing integration rows created before this change (plaintext JSON in `config`) are still readable after the change (graceful fallback)
- [ ] `backend/internal/repository/integration_test.go` updated or new test added covering encrypt → store → read → decrypt round-trip


