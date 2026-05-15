//go:build integration

package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/testutil"
)

// seedTestPermissions inserts a minimal set of permissions for RBAC tests.
// Must be called after ResetDB since TRUNCATE removes seeded data.
func seedTestPermissions(t testing.TB, ctx context.Context) {
	t.Helper()
	_, err := sharedDB.Pool.Exec(ctx, `
		INSERT INTO permissions (id, name) VALUES
			('perm-test-view',   'view:test'),
			('perm-test-create', 'create:test'),
			('perm-test-delete', 'delete:test')
		ON CONFLICT DO NOTHING
	`)
	if err != nil {
		t.Fatalf("seed test permissions: %v", err)
	}
}

func TestRBACRepository_CreateAndGetRole(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)
	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rbac-cr", "RBAC Create Tenant")

	tenantID := "t-rbac-cr"
	role := &domain.Role{
		ID:       "role-rbac-1",
		Name:     "editor",
		TenantID: &tenantID,
	}
	if err := repo.CreateRole(ctx, role); err != nil {
		t.Fatalf("create role: %v", err)
	}

	got, err := repo.GetRoleByID(ctx, "role-rbac-1")
	if err != nil {
		t.Fatalf("get role: %v", err)
	}
	if got.Name != "editor" {
		t.Errorf("name=%q, want editor", got.Name)
	}
	if got.TenantID == nil || *got.TenantID != tenantID {
		t.Errorf("tenantID=%v, want %q", got.TenantID, tenantID)
	}
}

func TestRBACRepository_GetRoleByID_NotFound(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	_, err := repo.GetRoleByID(ctx, "role-nonexistent")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestRBACRepository_DeleteRole(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-del", "del-role", nil)

	if err := repo.DeleteRole(ctx, "role-del"); err != nil {
		t.Fatalf("delete role: %v", err)
	}

	_, err := repo.GetRoleByID(ctx, "role-del")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound after delete, got %v", err)
	}
}

func TestRBACRepository_AssignAndRemoveRole(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rbac-ar", "RBAC Assign Tenant")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-rbac-ar", "rbac-assign@test.com")
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-ar", "assign-role", testutil.Ptr("t-rbac-ar"))

	if err := repo.AssignRole(ctx, "u-rbac-ar", "t-rbac-ar", "role-ar"); err != nil {
		t.Fatalf("assign role: %v", err)
	}

	got, err := repo.GetRoleForUser(ctx, "u-rbac-ar", "t-rbac-ar")
	if err != nil {
		t.Fatalf("get role for user: %v", err)
	}
	if got == nil || got.ID != "role-ar" {
		t.Errorf("expected role-ar, got %v", got)
	}

	if err := repo.RemoveRole(ctx, "u-rbac-ar", "t-rbac-ar", "role-ar"); err != nil {
		t.Fatalf("remove role: %v", err)
	}

	after, err := repo.GetRoleForUser(ctx, "u-rbac-ar", "t-rbac-ar")
	if err != nil {
		t.Fatalf("get role after remove: %v", err)
	}
	if after != nil {
		t.Error("expected nil role after remove, got non-nil")
	}
}

func TestRBACRepository_GetRoleForUser_NotAssigned(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rbac-na", "RBAC NA Tenant")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-rbac-na", "rbac-na@test.com")

	got, err := repo.GetRoleForUser(ctx, "u-rbac-na", "t-rbac-na")
	if err != nil {
		t.Fatalf("unexpected error for unassigned user: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil role for unassigned user, got %+v", got)
	}
}

func TestRBACRepository_GetRolesForUsers_Batch(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rbac-batch", "RBAC Batch Tenant")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-batch-1", "batch1@test.com")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-batch-2", "batch2@test.com")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-batch-3", "batch3@test.com")
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-batch", "batch-role", testutil.Ptr("t-rbac-batch"))

	if err := repo.AssignRole(ctx, "u-batch-1", "t-rbac-batch", "role-batch"); err != nil {
		t.Fatalf("assign u1: %v", err)
	}
	if err := repo.AssignRole(ctx, "u-batch-2", "t-rbac-batch", "role-batch"); err != nil {
		t.Fatalf("assign u2: %v", err)
	}

	// u-batch-3 has no role — map should not contain it
	result, err := repo.GetRolesForUsers(ctx, []string{"u-batch-1", "u-batch-2", "u-batch-3"}, "t-rbac-batch")
	if err != nil {
		t.Fatalf("get roles for users: %v", err)
	}
	if len(result) != 2 {
		t.Errorf("result len=%d, want 2", len(result))
	}
	if result["u-batch-1"] == nil || result["u-batch-1"].ID != "role-batch" {
		t.Error("u-batch-1 should have role-batch")
	}
	if result["u-batch-3"] != nil {
		t.Error("u-batch-3 should not appear in result (no role)")
	}

	// Empty input returns empty map without error
	empty, err := repo.GetRolesForUsers(ctx, nil, "t-rbac-batch")
	if err != nil {
		t.Fatalf("get roles for empty slice: %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("expected empty map for nil input, got %v", empty)
	}
}

func TestRBACRepository_SetRolePermissions(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	seedTestPermissions(t, ctx)
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-perms", "perms-role", nil)

	// Set two permissions
	if err := repo.SetRolePermissions(ctx, "role-perms", []string{"view:test", "create:test"}); err != nil {
		t.Fatalf("set permissions: %v", err)
	}
	got, err := repo.GetRoleByID(ctx, "role-perms")
	if err != nil {
		t.Fatalf("get role: %v", err)
	}
	if len(got.Permissions) != 2 {
		t.Errorf("permissions len=%d, want 2", len(got.Permissions))
	}

	// Replace with a single permission
	if err := repo.SetRolePermissions(ctx, "role-perms", []string{"delete:test"}); err != nil {
		t.Fatalf("replace permissions: %v", err)
	}
	got2, err := repo.GetRoleByID(ctx, "role-perms")
	if err != nil {
		t.Fatalf("get role after replace: %v", err)
	}
	if len(got2.Permissions) != 1 || got2.Permissions[0] != "delete:test" {
		t.Errorf("permissions after replace=%v, want [delete:test]", got2.Permissions)
	}

	// Clear all permissions
	if err := repo.SetRolePermissions(ctx, "role-perms", nil); err != nil {
		t.Fatalf("clear permissions: %v", err)
	}
	got3, err := repo.GetRoleByID(ctx, "role-perms")
	if err != nil {
		t.Fatalf("get role after clear: %v", err)
	}
	if len(got3.Permissions) != 0 {
		t.Errorf("permissions after clear=%v, want []", got3.Permissions)
	}
}

func TestRBACRepository_ListPermissions(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	seedTestPermissions(t, ctx)

	perms, err := repo.ListPermissions(ctx)
	if err != nil {
		t.Fatalf("list permissions: %v", err)
	}
	if len(perms) < 3 {
		t.Errorf("expected >= 3 permissions, got %d", len(perms))
	}
}

func TestRBACRepository_ListRoles(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rbac-lr", "RBAC LR Tenant")
	tenantID := "t-rbac-lr"

	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-global-lr", "global-role", nil)
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-tenant-lr", "tenant-role", &tenantID)

	roles, err := repo.ListRoles(ctx, tenantID)
	if err != nil {
		t.Fatalf("list roles: %v", err)
	}
	// SQL returns roles WHERE tenant_id IS NULL OR tenant_id = $1
	if len(roles) < 2 {
		t.Errorf("expected >= 2 roles (global + tenant), got %d", len(roles))
	}
}

func TestRBACRepository_GetPermissionsForUser(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rbac-perm", "RBAC Perm Tenant")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-rbac-perm", "perm-user@test.com")
	seedTestPermissions(t, ctx)

	tenantID := "t-rbac-perm"
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-perm-user", "perm-user-role", &tenantID)
	if err := repo.SetRolePermissions(ctx, "role-perm-user", []string{"view:test"}); err != nil {
		t.Fatalf("set permissions: %v", err)
	}
	if err := repo.AssignRole(ctx, "u-rbac-perm", "t-rbac-perm", "role-perm-user"); err != nil {
		t.Fatalf("assign role: %v", err)
	}

	perms, err := repo.GetPermissionsForUser(ctx, "u-rbac-perm", "t-rbac-perm")
	if err != nil {
		t.Fatalf("get permissions: %v", err)
	}
	if len(perms) != 1 || perms[0] != "view:test" {
		t.Errorf("permissions=%v, want [view:test]", perms)
	}
}

func TestRBACRepository_GetTenantsForUser(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rbac-gt1", "Tenant GT1")
	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rbac-gt2", "Tenant GT2")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-rbac-gt", "gt-user@test.com")
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-gt1", "gt1-role", testutil.Ptr("t-rbac-gt1"))
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-gt2", "gt2-role", testutil.Ptr("t-rbac-gt2"))

	if err := repo.AssignRole(ctx, "u-rbac-gt", "t-rbac-gt1", "role-gt1"); err != nil {
		t.Fatalf("assign gt1: %v", err)
	}
	if err := repo.AssignRole(ctx, "u-rbac-gt", "t-rbac-gt2", "role-gt2"); err != nil {
		t.Fatalf("assign gt2: %v", err)
	}

	tenants, err := repo.GetTenantsForUser(ctx, "u-rbac-gt")
	if err != nil {
		t.Fatalf("get tenants: %v", err)
	}
	if len(tenants) != 2 {
		t.Errorf("tenants len=%d, want 2", len(tenants))
	}
}

func TestRBACRepository_RemoveAllRolesForUserInTenant(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rbac-rem1", "RBAC Remove T1")
	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rbac-rem2", "RBAC Remove T2")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-rbac-rem", "rem@test.com")
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-rem1", "rem-role1", testutil.Ptr("t-rbac-rem1"))
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-rem2", "rem-role2", testutil.Ptr("t-rbac-rem2"))

	if err := repo.AssignRole(ctx, "u-rbac-rem", "t-rbac-rem1", "role-rem1"); err != nil {
		t.Fatalf("assign rem1: %v", err)
	}
	if err := repo.AssignRole(ctx, "u-rbac-rem", "t-rbac-rem2", "role-rem2"); err != nil {
		t.Fatalf("assign rem2: %v", err)
	}

	if err := repo.RemoveAllRolesForUserInTenant(ctx, "u-rbac-rem", "t-rbac-rem1"); err != nil {
		t.Fatalf("remove all in t1: %v", err)
	}

	// Tenant 1: no role
	got1, err := repo.GetRoleForUser(ctx, "u-rbac-rem", "t-rbac-rem1")
	if err != nil {
		t.Fatalf("get role t1: %v", err)
	}
	if got1 != nil {
		t.Error("expected no role in tenant 1 after RemoveAll")
	}

	// Tenant 2: still has role (isolation)
	got2, err := repo.GetRoleForUser(ctx, "u-rbac-rem", "t-rbac-rem2")
	if err != nil {
		t.Fatalf("get role t2: %v", err)
	}
	if got2 == nil {
		t.Error("expected role in tenant 2 to still exist")
	}
}

func TestRBACRepository_TenantIsolation(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewRBACRepository(sharedDB.Pool)

	seedTestPermissions(t, ctx)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-iso-a", "Tenant ISO A")
	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-iso-b", "Tenant ISO B")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-iso-a", "iso-a@test.com")
	testutil.MustCreateUser(ctx, t, sharedDB.Pool, "u-iso-b", "iso-b@test.com")

	tenantA, tenantB := "t-iso-a", "t-iso-b"
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-iso-a", "role-a", &tenantA)
	testutil.MustCreateRole(ctx, t, sharedDB.Pool, "role-iso-b", "role-b", &tenantB)

	if err := repo.SetRolePermissions(ctx, "role-iso-a", []string{"view:test"}); err != nil {
		t.Fatalf("set perms A: %v", err)
	}
	if err := repo.SetRolePermissions(ctx, "role-iso-b", []string{"create:test"}); err != nil {
		t.Fatalf("set perms B: %v", err)
	}
	if err := repo.AssignRole(ctx, "u-iso-a", tenantA, "role-iso-a"); err != nil {
		t.Fatalf("assign A: %v", err)
	}
	if err := repo.AssignRole(ctx, "u-iso-b", tenantB, "role-iso-b"); err != nil {
		t.Fatalf("assign B: %v", err)
	}

	// User A in tenant A sees their own permissions
	permsA, err := repo.GetPermissionsForUser(ctx, "u-iso-a", tenantA)
	if err != nil {
		t.Fatalf("get perms A in A: %v", err)
	}
	if len(permsA) != 1 || permsA[0] != "view:test" {
		t.Errorf("permsA=%v, want [view:test]", permsA)
	}

	// User A in tenant B sees nothing (cross-tenant isolation)
	permsAinB, err := repo.GetPermissionsForUser(ctx, "u-iso-a", tenantB)
	if err != nil {
		t.Fatalf("get perms A in B: %v", err)
	}
	if len(permsAinB) != 0 {
		t.Errorf("user A should have no perms in tenant B, got %v", permsAinB)
	}

	// GetRoleForUser also isolates across tenants
	roleAinB, err := repo.GetRoleForUser(ctx, "u-iso-a", tenantB)
	if err != nil {
		t.Fatalf("get role A in B: %v", err)
	}
	if roleAinB != nil {
		t.Errorf("user A should have no role in tenant B, got %v", roleAinB)
	}
}
