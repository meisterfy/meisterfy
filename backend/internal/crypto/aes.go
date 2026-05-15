package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

// Encrypt encrypts plaintext using AES-256-GCM with a random nonce.
// Returns base64(nonce || ciphertext || tag).
func Encrypt(key []byte, plaintext string) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// Decrypt decrypts a value produced by Encrypt.
func Decrypt(key []byte, ciphertext string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(data) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce, sealed := data[:gcm.NonceSize()], data[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, sealed, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

// EncryptPtr encrypts a *string, returning nil if input is nil or empty.
func EncryptPtr(key []byte, s *string) (*string, error) {
	if s == nil || *s == "" {
		return s, nil
	}
	enc, err := Encrypt(key, *s)
	if err != nil {
		return nil, err
	}
	return &enc, nil
}

// DecryptPtr decrypts a *string, returning nil if input is nil or empty.
func DecryptPtr(key []byte, s *string) (*string, error) {
	if s == nil || *s == "" {
		return s, nil
	}
	dec, err := Decrypt(key, *s)
	if err != nil {
		return nil, err
	}
	return &dec, nil
}
