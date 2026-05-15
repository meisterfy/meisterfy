//go:build integration

package repository

import (
	"context"
	"testing"

	"github.com/mkt-maestro/mkt-maestro/testutil"
)

func TestAlertRepository_CreateAndListOpen(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAlertRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-alert", "Alert Tenant")
	testutil.MustCreateAlert(ctx, t, sharedDB.Pool, "alert-1", "tenant-alert", "WARN", "budget", "over budget")

	list, err := repo.ListOpen(ctx, "tenant-alert")
	if err != nil {
		t.Fatalf("list open: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("len(list) = %d, want 1", len(list))
	}
	if list[0].Message != "over budget" {
		t.Errorf("message = %q, want %q", list[0].Message, "over budget")
	}
}

func TestAlertRepository_CountOpen(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAlertRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-alert2", "Alert Tenant 2")
	testutil.MustCreateAlert(ctx, t, sharedDB.Pool, "alert-2", "tenant-alert2", "CRITICAL", "cpa", "too high")

	count, err := repo.CountOpen(ctx, "tenant-alert2")
	if err != nil {
		t.Fatalf("count open: %v", err)
	}
	if count != 1 {
		t.Errorf("count = %d, want 1", count)
	}
}

func TestAlertRepository_ResolveAndIgnore(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAlertRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-alert3", "Alert Tenant 3")
	testutil.MustCreateAlert(ctx, t, sharedDB.Pool, "alert-3", "tenant-alert3", "WARN", "budget", "msg")

	if err := repo.Resolve(ctx, "alert-3"); err != nil {
		t.Fatalf("resolve: %v", err)
	}

	open, err := repo.ListOpen(ctx, "tenant-alert3")
	if err != nil {
		t.Fatalf("list open after resolve: %v", err)
	}
	if len(open) != 0 {
		t.Errorf("len(open) = %d, want 0", len(open))
	}

	history, err := repo.ListHistory(ctx, "tenant-alert3", 10)
	if err != nil {
		t.Fatalf("list history: %v", err)
	}
	if len(history) != 1 {
		t.Errorf("len(history) = %d, want 1", len(history))
	}
}

func TestAlertRepository_Ignore(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAlertRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-alert-ig", "Alert Ignore Tenant")
	testutil.MustCreateAlert(ctx, t, sharedDB.Pool, "alert-ig-1", "tenant-alert-ig", "WARN", "budget", "to ignore")

	if err := repo.Ignore(ctx, "alert-ig-1"); err != nil {
		t.Fatalf("ignore: %v", err)
	}

	open, err := repo.ListOpen(ctx, "tenant-alert-ig")
	if err != nil {
		t.Fatalf("list open after ignore: %v", err)
	}
	if len(open) != 0 {
		t.Errorf("len(open)=%d, want 0 after ignore", len(open))
	}
}

func TestAlertRepository_Create(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAlertRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-alert-cr", "Alert Create Tenant")

	a := AlertEvent{
		ID:       "alert-cr-1",
		TenantID: "tenant-alert-cr",
		Level:    "CRITICAL",
		Type:     "cpa",
		Message:  "CPA too high",
		Details:  []byte(`{"cpa": 150}`),
	}
	if err := repo.Create(ctx, a); err != nil {
		t.Fatalf("create: %v", err)
	}

	list, err := repo.ListOpen(ctx, "tenant-alert-cr")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("len=%d, want 1", len(list))
	}
	if list[0].Level != "CRITICAL" {
		t.Errorf("level=%q, want CRITICAL", list[0].Level)
	}
}
