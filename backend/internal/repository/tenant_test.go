//go:build integration

package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/meisterfy/meisterfy/internal/domain"
)

func TestTenantRepository_CreateAndGet(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewTenantRepository(sharedDB.Pool)

	tenant := &domain.Tenant{
		ID:   "tenant-1",
		Name: "Test Tenant",
	}

	if err := repo.Create(ctx, tenant); err != nil {
		t.Fatalf("create tenant: %v", err)
	}

	got, err := repo.GetByID(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("get tenant: %v", err)
	}
	if got.Name != "Test Tenant" {
		t.Errorf("name = %q, want %q", got.Name, "Test Tenant")
	}
}

func TestTenantRepository_List(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewTenantRepository(sharedDB.Pool)

	for _, id := range []string{"a", "b", "c"} {
		if err := repo.Create(ctx, &domain.Tenant{ID: id, Name: id}); err != nil {
			t.Fatalf("create tenant %s: %v", id, err)
		}
	}

	list, err := repo.List(ctx)
	if err != nil {
		t.Fatalf("list tenants: %v", err)
	}
	if len(list) != 3 {
		t.Errorf("len(list) = %d, want 3", len(list))
	}
}

func TestTenantRepository_ResetDB(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewTenantRepository(sharedDB.Pool)

	if err := repo.Create(ctx, &domain.Tenant{ID: "x", Name: "x"}); err != nil {
		t.Fatalf("create: %v", err)
	}

	sharedDB.ResetDB(t)

	_, err := repo.GetByID(ctx, "x")
	if err == nil {
		t.Error("expected error after reset, got nil")
	}
}

func TestTenantRepository_GetByID_NotFound(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewTenantRepository(sharedDB.Pool)

	_, err := repo.GetByID(ctx, "tenant-nonexistent")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestTenantRepository_Create_DuplicateID(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewTenantRepository(sharedDB.Pool)

	tenant := &domain.Tenant{ID: "t-dup", Name: "Dup"}
	if err := repo.Create(ctx, tenant); err != nil {
		t.Fatalf("first create: %v", err)
	}
	if err := repo.Create(ctx, tenant); err == nil {
		t.Error("expected error on duplicate ID, got nil")
	}
}

func TestTenantRepository_UpdateAndDelete(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewTenantRepository(sharedDB.Pool)

	tenant := &domain.Tenant{ID: "t-upd", Name: "Original"}
	if err := repo.Create(ctx, tenant); err != nil {
		t.Fatalf("create: %v", err)
	}

	tenant.Name = "Updated"
	if err := repo.Update(ctx, tenant); err != nil {
		t.Fatalf("update: %v", err)
	}

	got, err := repo.GetByID(ctx, "t-upd")
	if err != nil {
		t.Fatalf("get after update: %v", err)
	}
	if got.Name != "Updated" {
		t.Errorf("name=%q, want Updated", got.Name)
	}

	if err := repo.Delete(ctx, "t-upd"); err != nil {
		t.Fatalf("delete: %v", err)
	}

	_, err = repo.GetByID(ctx, "t-upd")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound after delete, got %v", err)
	}
}
