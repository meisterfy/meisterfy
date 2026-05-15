---
title: "test: backend unit — crypto (AES-256-GCM) and domain (JWT, password, user claims)"
created: 2026-05-15T14:32:17.793Z
priority: P1-S
status: backlog
tags: [test]
---

# test: backend unit — crypto (AES-256-GCM) and domain (JWT, password, user claims)

## Context
The two most security-critical packages in the backend — `internal/crypto` and `internal/domain` — have zero test coverage. These contain AES-256-GCM encryption/decryption, JWT issuance/parsing, bcrypt password hashing, and permission checking. Any regression here is a security incident.

## Files to create
- `backend/internal/crypto/aes_test.go`
- `backend/internal/domain/jwt_test.go`
- `backend/internal/domain/user_test.go`

## No build tags needed
These are pure unit tests — no database, no external dependencies.

---

## `crypto/aes_test.go`

Functions under test: `Encrypt(key []byte, plaintext string)` and `Decrypt(key []byte, ciphertext string)` in `backend/internal/crypto/aes.go`.

Table-driven, t.Parallel():

```go
package crypto

import (
    "strings"
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestEncryptDecrypt_RoundTrip(t *testing.T) {
    t.Parallel()
    key := []byte("12345678901234567890123456789012") // 32 bytes
    tests := []struct {
        name      string
        plaintext string
    }{
        {"empty string", ""},
        {"short text", "hello"},
        {"json payload", `{"api_key":"sk-secret-value","org":"acme"}`},
        {"unicode", "ção αβγ 日本語"},
        {"long text", strings.Repeat("x", 10_000)},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            ciphertext, err := Encrypt(key, tt.plaintext)
            require.NoError(t, err)
            got, err := Decrypt(key, ciphertext)
            require.NoError(t, err)
            assert.Equal(t, tt.plaintext, got)
        })
    }
}

func TestEncrypt_ProducesUniqueCiphertexts(t *testing.T) { ... }   // same input → different output (random nonce)
func TestDecrypt_WrongKey(t *testing.T) { ... }                     // expect error
func TestDecrypt_CorruptedBase64(t *testing.T) { ... }              // expect error
func TestDecrypt_TruncatedCiphertext(t *testing.T) { ... }          // len < NonceSize → "ciphertext too short"
func TestEncrypt_InvalidKeyLength(t *testing.T) { ... }             // key != 16/24/32 bytes → error from aes.NewCipher
```

---

## `domain/jwt_test.go`

Function under test: `JWTService` in `backend/internal/domain/jwt.go` — `IssueTokenPair`, `ParseAccessToken`, `ParseRefreshToken`.

```go
package domain

import (
    "testing"
    "time"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestJWTService_IssueAndParseAccessToken(t *testing.T) { ... }
func TestJWTService_ParseAccessToken_Expired(t *testing.T) { ... }   // issue with -1s TTL, expect error
func TestJWTService_ParseAccessToken_WrongSecret(t *testing.T) { ... }
func TestJWTService_ParseAccessToken_Tampered(t *testing.T) { ... }  // modify payload, expect error
func TestJWTService_IssueAndParseRefreshToken(t *testing.T) { ... }
func TestJWTService_ParseRefreshToken_Expired(t *testing.T) { ... }
func TestJWTService_ClaimsRoundTrip(t *testing.T) { ... }            // all UserClaims fields preserved
```

Test the full UserClaims struct: UserID, TenantID, Email, Role, Permissions []string.

---

## `domain/user_test.go`

Functions under test: `User.SetPassword`, `User.CheckPassword`, `UserClaims.HasPermission`.

```go
package domain

func TestUser_SetPassword_HashesInput(t *testing.T) { ... }        // stored != plain
func TestUser_SetPassword_DifferentHashEachTime(t *testing.T) { ... } // bcrypt is salted
func TestUser_CheckPassword_Correct(t *testing.T) { ... }
func TestUser_CheckPassword_Wrong(t *testing.T) { ... }
func TestUser_CheckPassword_EmptyPassword(t *testing.T) { ... }
func TestUserClaims_HasPermission(t *testing.T) {
    // table-driven: has "edit:post" → true, "delete:tenant" → false, empty list → false
}
```

---

## Patterns to follow
- All tests: `t.Parallel()` at top level and inside subtests
- Use `github.com/stretchr/testify/require` for fatal assertions, `assert` for non-fatal
- Table-driven with `name` field on every case
- No mocks needed — these are pure functions

## Acceptance criteria
- `go test -race -count=1 ./internal/crypto/... ./internal/domain/...` passes
- Every exported function in both packages has at least one happy-path and one error-path test
- Coverage on `crypto/aes.go`: 100%; `domain/jwt.go`: >90%; `domain/user.go`: 100%

## Dependencies
- TASK-050 (goleak + testify as real deps) — at minimum testify must be available. Can be done in parallel if testify is added manually first.


