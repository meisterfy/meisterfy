package crypto

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var validKey32 = []byte("12345678901234567890123456789012")

func TestEncryptDecrypt_RoundTrip(t *testing.T) {
	t.Parallel()
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
			ct, err := Encrypt(validKey32, tt.plaintext)
			require.NoError(t, err)
			got, err := Decrypt(validKey32, ct)
			require.NoError(t, err)
			assert.Equal(t, tt.plaintext, got)
		})
	}
}

func TestEncrypt_ProducesUniqueCiphertexts(t *testing.T) {
	t.Parallel()
	ct1, err := Encrypt(validKey32, "hello")
	require.NoError(t, err)
	ct2, err := Encrypt(validKey32, "hello")
	require.NoError(t, err)
	assert.NotEqual(t, ct1, ct2, "same plaintext must produce different ciphertexts (random nonce)")
}

func TestDecrypt_WrongKey(t *testing.T) {
	t.Parallel()
	ct, err := Encrypt(validKey32, "secret")
	require.NoError(t, err)
	wrongKey := []byte("00000000000000000000000000000000")
	_, err = Decrypt(wrongKey, ct)
	assert.Error(t, err)
}

func TestDecrypt_CorruptedBase64(t *testing.T) {
	t.Parallel()
	_, err := Decrypt(validKey32, "not-valid-base64!!!")
	assert.Error(t, err)
}

func TestDecrypt_TruncatedCiphertext(t *testing.T) {
	t.Parallel()
	short := base64.StdEncoding.EncodeToString([]byte("short")) // < NonceSize (12)
	_, err := Decrypt(validKey32, short)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ciphertext too short")
}

func TestEncrypt_InvalidKeyLength(t *testing.T) {
	t.Parallel()
	badKey := []byte("tooshort") // 8 bytes — AES requires 16, 24, or 32
	_, err := Encrypt(badKey, "hello")
	assert.Error(t, err)
}

func TestEncryptPtr_Nil(t *testing.T) {
	t.Parallel()
	got, err := EncryptPtr(validKey32, nil)
	require.NoError(t, err)
	assert.Nil(t, got)
}

func TestEncryptPtr_Empty(t *testing.T) {
	t.Parallel()
	s := ""
	got, err := EncryptPtr(validKey32, &s)
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, "", *got)
}

func TestEncryptPtr_DecryptPtr_RoundTrip(t *testing.T) {
	t.Parallel()
	s := "my-secret-api-key"
	enc, err := EncryptPtr(validKey32, &s)
	require.NoError(t, err)
	require.NotNil(t, enc)
	dec, err := DecryptPtr(validKey32, enc)
	require.NoError(t, err)
	require.NotNil(t, dec)
	assert.Equal(t, s, *dec)
}

func TestDecryptPtr_Nil(t *testing.T) {
	t.Parallel()
	got, err := DecryptPtr(validKey32, nil)
	require.NoError(t, err)
	assert.Nil(t, got)
}

func TestDecrypt_InvalidKeyLength(t *testing.T) {
	t.Parallel()
	ct, err := Encrypt(validKey32, "hello")
	require.NoError(t, err)
	badKey := []byte("tooshort")
	_, err = Decrypt(badKey, ct)
	assert.Error(t, err)
}

func TestEncryptPtr_InvalidKey(t *testing.T) {
	t.Parallel()
	s := "hello"
	badKey := []byte("tooshort")
	_, err := EncryptPtr(badKey, &s)
	assert.Error(t, err)
}

func TestDecryptPtr_InvalidKey(t *testing.T) {
	t.Parallel()
	ct, err := Encrypt(validKey32, "hello")
	require.NoError(t, err)
	badKey := []byte("tooshort")
	_, err = DecryptPtr(badKey, &ct)
	assert.Error(t, err)
}
