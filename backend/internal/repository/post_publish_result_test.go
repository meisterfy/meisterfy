//go:build integration

package repository

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/mkt-maestro/mkt-maestro/testutil"
)

func TestPostPublishResultRepository_CreateAndList(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostPublishResultRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-ppr", "PPR Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-ppr-1", "tenant-ppr", "content", "draft")

	now := time.Now().UTC()
	extID := "ext-fb-001"
	if err := repo.Create(ctx, CreatePublishResultParams{
		ID:          "ppr-1",
		PostID:      "post-ppr-1",
		Platform:    "facebook",
		Provider:    "meta",
		ExternalID:  &extID,
		Status:      "published",
		PublishedAt: &now,
	}); err != nil {
		t.Fatalf("create: %v", err)
	}

	results, err := repo.ListByPostID(ctx, "post-ppr-1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("len = %d, want 1", len(results))
	}

	got := results[0]
	if got.ID != "ppr-1" {
		t.Errorf("id = %q, want %q", got.ID, "ppr-1")
	}
	if got.Platform != "facebook" {
		t.Errorf("platform = %q, want %q", got.Platform, "facebook")
	}
	if got.ExternalID == nil || *got.ExternalID != extID {
		t.Errorf("external_id = %v, want %q", got.ExternalID, extID)
	}
	if got.Status != "published" {
		t.Errorf("status = %q, want %q", got.Status, "published")
	}
}

func TestPostPublishResultRepository_ListByPostID_Empty(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostPublishResultRepository(sharedDB.Pool)

	results, err := repo.ListByPostID(ctx, "post-does-not-exist")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("len = %d, want 0", len(results))
	}
}

func TestPostPublishResultRepository_ExistsForPost(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostPublishResultRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-ppr-ex", "PPR Exists Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-ppr-ex", "tenant-ppr-ex", "content", "draft")

	exists, err := repo.ExistsForPost(ctx, "post-ppr-ex")
	if err != nil {
		t.Fatalf("exists before create: %v", err)
	}
	if exists {
		t.Error("expected false before any result, got true")
	}

	if err := repo.Create(ctx, CreatePublishResultParams{
		ID:       "ppr-ex-1",
		PostID:   "post-ppr-ex",
		Platform: "instagram_feed",
		Provider: "meta",
		Status:   "published",
	}); err != nil {
		t.Fatalf("create: %v", err)
	}

	exists, err = repo.ExistsForPost(ctx, "post-ppr-ex")
	if err != nil {
		t.Fatalf("exists after create: %v", err)
	}
	if !exists {
		t.Error("expected true after create, got false")
	}
}

func TestPostPublishResultRepository_MultipleResultsForPost(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewPostPublishResultRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-ppr-m", "PPR Multi Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-ppr-m", "tenant-ppr-m", "content", "published")

	platforms := []string{"instagram_feed", "facebook"}
	for i, platform := range platforms {
		extID := fmt.Sprintf("ext-%d", i)
		now := time.Now().UTC()
		if err := repo.Create(ctx, CreatePublishResultParams{
			ID:          fmt.Sprintf("ppr-m-%d", i),
			PostID:      "post-ppr-m",
			Platform:    platform,
			Provider:    "meta",
			ExternalID:  &extID,
			Status:      "published",
			PublishedAt: &now,
		}); err != nil {
			t.Fatalf("create result %d: %v", i, err)
		}
	}

	results, err := repo.ListByPostID(ctx, "post-ppr-m")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(results) != 2 {
		t.Errorf("len = %d, want 2", len(results))
	}
}
