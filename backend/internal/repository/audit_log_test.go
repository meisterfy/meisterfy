//go:build integration

package repository

import (
	"context"
	"testing"
	"time"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/testutil"
)

func TestAuditLogRepository_Log(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAuditLogRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-audit", "Audit Tenant")

	if err := repo.Log(ctx, domain.AuditEntry{
		TenantID:   "t-audit",
		UserID:     "u-audit",
		UserName:   "Auditor",
		Action:     "create",
		EntityType: "post",
		EntityID:   "post-1",
	}); err != nil {
		t.Fatalf("log: %v", err)
	}

	entries, total, err := repo.List(ctx, domain.AuditLogFilter{TenantID: "t-audit", Limit: 10})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if total != 1 {
		t.Errorf("total=%d, want 1", total)
	}
	if len(entries) != 1 {
		t.Fatalf("len=%d, want 1", len(entries))
	}
	if entries[0].Action != "create" {
		t.Errorf("action=%q, want create", entries[0].Action)
	}
	if entries[0].EntityType != "post" {
		t.Errorf("entityType=%q, want post", entries[0].EntityType)
	}
}

func TestAuditLogRepository_Log_WithBeforeAfter(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAuditLogRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-audit-ba", "Audit BA Tenant")

	if err := repo.Log(ctx, domain.AuditEntry{
		TenantID:   "t-audit-ba",
		UserID:     "u-audit-ba",
		UserName:   "Editor",
		Action:     "update",
		EntityType: "post",
		EntityID:   "post-ba",
		Before:     map[string]any{"status": "draft"},
		After:      map[string]any{"status": "published"},
	}); err != nil {
		t.Fatalf("log: %v", err)
	}

	entries, _, err := repo.List(ctx, domain.AuditLogFilter{TenantID: "t-audit-ba", Limit: 10})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("len=%d, want 1", len(entries))
	}
	if entries[0].Before == nil {
		t.Error("before should not be nil")
	}
	if entries[0].After == nil {
		t.Error("after should not be nil")
	}
}

func TestAuditLogRepository_List_FilterByEntityType(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAuditLogRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-audit-et", "Audit EntityType Tenant")

	log := func(entityType, entityID string) {
		t.Helper()
		if err := repo.Log(ctx, domain.AuditEntry{
			TenantID:   "t-audit-et",
			UserID:     "u-et",
			UserName:   "User",
			Action:     "create",
			EntityType: entityType,
			EntityID:   entityID,
		}); err != nil {
			t.Fatalf("log %s/%s: %v", entityType, entityID, err)
		}
	}

	log("post", "p1")
	log("post", "p2")
	log("tenant", "t1")

	entityType := "post"
	entries, total, err := repo.List(ctx, domain.AuditLogFilter{
		TenantID:   "t-audit-et",
		EntityType: &entityType,
		Limit:      10,
	})
	if err != nil {
		t.Fatalf("list by entity type: %v", err)
	}
	if total != 2 {
		t.Errorf("total=%d, want 2", total)
	}
	if len(entries) != 2 {
		t.Errorf("len=%d, want 2", len(entries))
	}
}

func TestAuditLogRepository_List_FilterByEntityID(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAuditLogRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-audit-eid", "Audit EntityID Tenant")

	for _, id := range []string{"p1", "p2", "p3"} {
		if err := repo.Log(ctx, domain.AuditEntry{
			TenantID:   "t-audit-eid",
			UserID:     "u-eid",
			UserName:   "User",
			Action:     "create",
			EntityType: "post",
			EntityID:   id,
		}); err != nil {
			t.Fatalf("log %s: %v", id, err)
		}
	}

	entityID := "p2"
	entries, total, err := repo.List(ctx, domain.AuditLogFilter{
		TenantID: "t-audit-eid",
		EntityID: &entityID,
		Limit:    10,
	})
	if err != nil {
		t.Fatalf("list by entity id: %v", err)
	}
	if total != 1 {
		t.Errorf("total=%d, want 1", total)
	}
	if len(entries) != 1 || entries[0].EntityID != "p2" {
		t.Errorf("entries=%v, want single p2 entry", entries)
	}
}

func TestAuditLogRepository_List_TenantIsolation(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAuditLogRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-audit-iso1", "Audit ISO1")
	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-audit-iso2", "Audit ISO2")

	// Log entry for tenant 1 only
	if err := repo.Log(ctx, domain.AuditEntry{
		TenantID:   "t-audit-iso1",
		UserID:     "u-iso",
		UserName:   "User",
		Action:     "create",
		EntityType: "post",
		EntityID:   "p-iso",
	}); err != nil {
		t.Fatalf("log iso1: %v", err)
	}

	// Tenant 2 should see zero entries
	entries, total, err := repo.List(ctx, domain.AuditLogFilter{TenantID: "t-audit-iso2", Limit: 10})
	if err != nil {
		t.Fatalf("list iso2: %v", err)
	}
	if total != 0 {
		t.Errorf("tenant2 total=%d, want 0", total)
	}
	if len(entries) != 0 {
		t.Errorf("tenant2 entries=%d, want 0", len(entries))
	}
}

func TestAuditLogRepository_List_DefaultLimit(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAuditLogRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-audit-dl", "Audit Default Limit")

	// Limit=0 should default to 50 (code: if limit <= 0 || limit > 200 { limit = 50 })
	_, _, err := repo.List(ctx, domain.AuditLogFilter{TenantID: "t-audit-dl", Limit: 0})
	if err != nil {
		t.Fatalf("list with limit=0: %v", err)
	}
}

func TestAuditLogRepository_AsyncLog(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAuditLogRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-audit-async", "Audit Async Tenant")

	repo.AsyncLog(domain.AuditEntry{
		TenantID:   "t-audit-async",
		UserID:     "u-async",
		UserName:   "AsyncUser",
		Action:     "delete",
		EntityType: "post",
		EntityID:   "post-async",
	})

	// Give the goroutine time to complete
	time.Sleep(200 * time.Millisecond)

	_, total, err := repo.List(ctx, domain.AuditLogFilter{TenantID: "t-audit-async", Limit: 10})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if total != 1 {
		t.Errorf("total=%d, want 1", total)
	}
}

func TestAuditLogRepository_List_Pagination(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAuditLogRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-audit-page", "Audit Pagination Tenant")

	for i := 0; i < 5; i++ {
		if err := repo.Log(ctx, domain.AuditEntry{
			TenantID:   "t-audit-page",
			UserID:     "u-page",
			UserName:   "User",
			Action:     "create",
			EntityType: "post",
			EntityID:   "p" + string(rune('0'+i)),
		}); err != nil {
			t.Fatalf("log %d: %v", i, err)
		}
	}

	page1, total, err := repo.List(ctx, domain.AuditLogFilter{TenantID: "t-audit-page", Limit: 2, Offset: 0})
	if err != nil {
		t.Fatalf("page1: %v", err)
	}
	if total != 5 {
		t.Errorf("total=%d, want 5", total)
	}
	if len(page1) != 2 {
		t.Errorf("page1 len=%d, want 2", len(page1))
	}

	page2, _, err := repo.List(ctx, domain.AuditLogFilter{TenantID: "t-audit-page", Limit: 2, Offset: 2})
	if err != nil {
		t.Fatalf("page2: %v", err)
	}
	if len(page2) != 2 {
		t.Errorf("page2 len=%d, want 2", len(page2))
	}
}
