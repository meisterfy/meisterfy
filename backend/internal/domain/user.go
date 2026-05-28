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
	TokenVersion int
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
	UserID       string
	UserName     string
	TenantID     string
	Permissions  []string
	SystemRole   string
	TokenVersion int
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

// dummyPasswordHash is a valid bcrypt hash (same cost as real ones) used purely
// to spend comparable CPU time when authenticating a non-existent user.
var dummyPasswordHash, _ = bcrypt.GenerateFromPassword([]byte("meisterfy-timing-equalizer"), 12)

// FakePasswordCheck runs a bcrypt comparison against a throwaway hash so that a
// failed login takes roughly the same time whether or not the email exists,
// preventing account enumeration via response-time differences.
func FakePasswordCheck(plain string) {
	_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(plain))
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
