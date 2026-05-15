package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUser_SetPassword_HashesInput(t *testing.T) {
	t.Parallel()
	u := &User{}
	require.NoError(t, u.SetPassword("my-secure-password"))
	assert.NotEmpty(t, u.PasswordHash)
	assert.NotEqual(t, "my-secure-password", u.PasswordHash)
}

func TestUser_SetPassword_DifferentHashEachTime(t *testing.T) {
	t.Parallel()
	u1, u2 := &User{}, &User{}
	require.NoError(t, u1.SetPassword("same-password"))
	require.NoError(t, u2.SetPassword("same-password"))
	assert.NotEqual(t, u1.PasswordHash, u2.PasswordHash, "bcrypt must use a random salt")
}

func TestUser_CheckPassword_Correct(t *testing.T) {
	t.Parallel()
	u := &User{}
	require.NoError(t, u.SetPassword("correct-password"))
	assert.True(t, u.CheckPassword("correct-password"))
}

func TestUser_CheckPassword_Wrong(t *testing.T) {
	t.Parallel()
	u := &User{}
	require.NoError(t, u.SetPassword("correct-password"))
	assert.False(t, u.CheckPassword("wrong-password"))
}

func TestUser_CheckPassword_EmptyPassword(t *testing.T) {
	t.Parallel()
	u := &User{}
	require.NoError(t, u.SetPassword("correct-password"))
	assert.False(t, u.CheckPassword(""))
}

func TestUserClaims_HasPermission(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		perms []string
		query string
		want  bool
	}{
		{"has permission", []string{"read:post", "edit:post"}, "edit:post", true},
		{"does not have permission", []string{"read:post"}, "delete:tenant", false},
		{"empty permissions list", []string{}, "read:post", false},
		{"nil permissions list", nil, "read:post", false},
		{"partial match is not a match", []string{"read:post"}, "read:pos", false},
		{"prefix match is not a match", []string{"read:post"}, "read:post:extra", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			c := &UserClaims{Permissions: tt.perms}
			assert.Equal(t, tt.want, c.HasPermission(tt.query))
		})
	}
}
