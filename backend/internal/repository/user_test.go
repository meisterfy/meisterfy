//go:build integration

package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/testutil"
)

func TestUserRepository_Create(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewUserRepository(sharedDB.Pool)

	u := &domain.User{
		ID:           "u-cr-1",
		Name:         "Alice",
		Email:        "alice@test.com",
		PasswordHash: "hash",
		Locale:       "pt_BR",
		Timezone:     "UTC",
		IsActive:     true,
	}
	if err := repo.Create(ctx, u); err != nil {
		t.Fatalf("create: %v", err)
	}

	tests := []struct {
		name    string
		user    *domain.User
		wantErr bool
	}{
		{
			"duplicate id",
			&domain.User{ID: "u-cr-1", Name: "Dup", Email: "dup@test.com", PasswordHash: "h", Locale: "pt_BR", Timezone: "UTC"},
			true,
		},
		{
			"duplicate email",
			&domain.User{ID: "u-cr-2", Name: "Dup2", Email: "alice@test.com", PasswordHash: "h", Locale: "pt_BR", Timezone: "UTC"},
			true,
		},
		{
			"valid second user",
			&domain.User{ID: "u-cr-3", Name: "Bob", Email: "bob@test.com", PasswordHash: "h", Locale: "pt_BR", Timezone: "UTC"},
			false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := repo.Create(ctx, tt.user)
			if (err != nil) != tt.wantErr {
				t.Errorf("wantErr=%v, got %v", tt.wantErr, err)
			}
		})
	}
}

func TestUserRepository_GetByID(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewUserRepository(sharedDB.Pool)
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-getid-1", "getbyid@test.com")

	tests := []struct {
		name      string
		id        string
		wantErr   bool
		wantErrIs error
	}{
		{"found", "u-getid-1", false, nil},
		{"not found", "u-nonexistent", true, domain.ErrNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := repo.GetByID(ctx, tt.id)
			if (err != nil) != tt.wantErr {
				t.Fatalf("wantErr=%v, got %v", tt.wantErr, err)
			}
			if tt.wantErrIs != nil && !errors.Is(err, tt.wantErrIs) {
				t.Errorf("err=%v, want errors.Is(%v)", err, tt.wantErrIs)
			}
			if !tt.wantErr && got.ID != tt.id {
				t.Errorf("ID=%q, want %q", got.ID, tt.id)
			}
		})
	}
}

func TestUserRepository_GetByEmail(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewUserRepository(sharedDB.Pool)
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-email-1", "findme@test.com")

	tests := []struct {
		name      string
		email     string
		wantErr   bool
		wantErrIs error
	}{
		{"found", "findme@test.com", false, nil},
		{"not found", "nobody@test.com", true, domain.ErrNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := repo.GetByEmail(ctx, tt.email)
			if (err != nil) != tt.wantErr {
				t.Fatalf("wantErr=%v, got %v", tt.wantErr, err)
			}
			if tt.wantErrIs != nil && !errors.Is(err, tt.wantErrIs) {
				t.Errorf("err=%v, want errors.Is(%v)", err, tt.wantErrIs)
			}
			if !tt.wantErr && got.Email != tt.email {
				t.Errorf("email=%q, want %q", got.Email, tt.email)
			}
		})
	}
}

func TestUserRepository_Update(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewUserRepository(sharedDB.Pool)
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-upd-1", "upd@test.com")

	u := &domain.User{
		ID:       "u-upd-1",
		Name:     "Updated Name",
		Email:    "updated@test.com",
		Locale:   "en_US",
		Timezone: "America/New_York",
		IsActive: false,
	}
	if err := repo.Update(ctx, u); err != nil {
		t.Fatalf("update: %v", err)
	}

	got, err := repo.GetByID(ctx, "u-upd-1")
	if err != nil {
		t.Fatalf("get after update: %v", err)
	}
	if got.Name != "Updated Name" {
		t.Errorf("name=%q, want Updated Name", got.Name)
	}
	if got.IsActive {
		t.Error("is_active should be false after update")
	}
}

func TestUserRepository_UpdatePasswordHash(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewUserRepository(sharedDB.Pool)
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-pw-1", "pw@test.com")

	if err := repo.UpdatePasswordHash(ctx, "u-pw-1", "newhash"); err != nil {
		t.Fatalf("update password hash: %v", err)
	}

	got, err := repo.GetByID(ctx, "u-pw-1")
	if err != nil {
		t.Fatalf("get after password update: %v", err)
	}
	if got.PasswordHash != "newhash" {
		t.Errorf("password_hash=%q, want newhash", got.PasswordHash)
	}
}

func TestUserRepository_Delete(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewUserRepository(sharedDB.Pool)
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-del-1", "del@test.com")

	if err := repo.Delete(ctx, "u-del-1"); err != nil {
		t.Fatalf("delete: %v", err)
	}

	_, err := repo.GetByID(ctx, "u-del-1")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound after delete, got %v", err)
	}
}

func TestUserRepository_List(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewUserRepository(sharedDB.Pool)

	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-list-1", "list1@test.com")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-list-2", "list2@test.com")

	users, err := repo.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(users) != 2 {
		t.Errorf("len(users)=%d, want 2", len(users))
	}
}

func TestUserRepository_Count(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewUserRepository(sharedDB.Pool)

	count, err := repo.Count(ctx)
	if err != nil {
		t.Fatalf("count empty: %v", err)
	}
	if count != 0 {
		t.Errorf("count=%d, want 0 on empty DB", count)
	}

	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-cnt-1", "cnt1@test.com")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-cnt-2", "cnt2@test.com")

	count, err = repo.Count(ctx)
	if err != nil {
		t.Fatalf("count after insert: %v", err)
	}
	if count != 2 {
		t.Errorf("count=%d, want 2", count)
	}
}

func TestUserRepository_ListForTenant(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewUserRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-lft-1", "Tenant LFT")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-lft-1", "lft1@test.com")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-lft-2", "lft2@test.com")

	// Create a role scoped to the tenant and assign u-lft-1
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-lft", "lft-role", testutil.Ptr("t-lft-1"))
	if _, err := sharedDB.Pool.Exec(ctx,
		`INSERT INTO user_tenant_roles (user_id, tenant_id, role_id) VALUES ($1, $2, $3)`,
		"u-lft-1", "t-lft-1", "role-lft",
	); err != nil {
		t.Fatalf("assign role: %v", err)
	}

	users, err := repo.ListForTenant(ctx, "t-lft-1")
	if err != nil {
		t.Fatalf("list for tenant: %v", err)
	}
	if len(users) != 1 {
		t.Errorf("len=%d, want 1", len(users))
	}
	if users[0].ID != "u-lft-1" {
		t.Errorf("user ID=%q, want u-lft-1", users[0].ID)
	}
}
