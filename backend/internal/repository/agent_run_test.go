//go:build integration

package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/testutil"
)

func TestAgentRunRepository_LogAndListRecent(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAgentRunRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-ar", "AgentRun Tenant")

	if err := repo.Log(ctx, "tenant-ar", "scheduler", "success", "daily run"); err != nil {
		t.Fatalf("log: %v", err)
	}

	runs, err := repo.ListRecent(ctx, "tenant-ar", 10)
	if err != nil {
		t.Fatalf("list recent: %v", err)
	}
	if len(runs) != 1 {
		t.Errorf("len(runs) = %d, want 1", len(runs))
	}
	if runs[0].Agent != "scheduler" {
		t.Errorf("agent = %q, want %q", runs[0].Agent, "scheduler")
	}
}

func TestAgentRunRepository_GetLast(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAgentRunRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-ar2", "AgentRun Tenant 2")
	testutil.MustCreateAgentRun(ctx, t, sharedDB.Pool, "ar-1", "tenant-ar2", "sync", "error", time.Now().Add(-time.Hour))
	testutil.MustCreateAgentRun(ctx, t, sharedDB.Pool, "ar-2", "tenant-ar2", "sync", "success", time.Now())

	last, err := repo.GetLast(ctx, "tenant-ar2", "sync")
	if err != nil {
		t.Fatalf("get last: %v", err)
	}
	if last.Status != "success" {
		t.Errorf("status = %q, want %q", last.Status, "success")
	}
	if last.ID != "ar-2" {
		t.Errorf("id = %q, want %q", last.ID, "ar-2")
	}
}

func TestAgentRunRepository_GetLast_NotFound(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewAgentRunRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-ar-nf", "AgentRun NF Tenant")

	_, err := repo.GetLast(ctx, "tenant-ar-nf", "nonexistent-agent")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}
