package domain

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
)

// GenerateMCPKey returns (fullKey, prefix, sha256Hex, err).
// Format: "msk_" + 32 random bytes base64url-encoded (no padding) ≈ 47 chars total.
// prefix = first 12 chars of fullKey.
// sha256Hex = hex(sha256(fullKey)).
func GenerateMCPKey() (fullKey, prefix, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	fullKey = "msk_" + base64.RawURLEncoding.EncodeToString(b)
	prefix = fullKey[:12]
	sum := sha256.Sum256([]byte(fullKey))
	hash = hex.EncodeToString(sum[:])
	return
}
