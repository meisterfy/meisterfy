//go:build integration

package repository

import (
	"context"
	"testing"
	"time"

	"github.com/meisterfy/meisterfy/testutil"
)

func TestPostInsightRepository_UpsertAndList(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	insightRepo := NewPostInsightRepository(sharedDB.Pool)
	publishRepo := NewPostPublishResultRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-pi", "PI Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-pi-1", "tenant-pi", "content", "published")

	now := time.Now().UTC()
	extID := "ext-pi-1"
	if err := publishRepo.Create(ctx, CreatePublishResultParams{
		ID:          "ppr-pi-1",
		PostID:      "post-pi-1",
		Platform:    "instagram_feed",
		Provider:    "meta",
		ExternalID:  &extID,
		Status:      "published",
		PublishedAt: &now,
	}); err != nil {
		t.Fatalf("create publish result: %v", err)
	}

	if err := insightRepo.Upsert(ctx, UpsertInsightParams{
		ID:              "pi-1",
		PublishResultID: "ppr-pi-1",
		PostID:          "post-pi-1",
		Platform:        "instagram_feed",
		Window:          "24h",
		Metrics:         map[string]any{"impressions": 100, "reach": 80},
		RawResponse:     map[string]any{"data": []any{}},
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	list, err := insightRepo.ListByPostID(ctx, "post-pi-1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("len = %d, want 1", len(list))
	}

	got := list[0]
	if got.Platform != "instagram_feed" {
		t.Errorf("platform = %q, want %q", got.Platform, "instagram_feed")
	}
	if got.InsightWindow != "24h" {
		t.Errorf("window = %q, want %q", got.InsightWindow, "24h")
	}
	if val, ok := got.Metrics["impressions"].(float64); !ok || val != 100 {
		t.Errorf("metrics.impressions = %v, want 100", got.Metrics["impressions"])
	}
}

func TestPostInsightRepository_Upsert_Idempotent(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	insightRepo := NewPostInsightRepository(sharedDB.Pool)
	publishRepo := NewPostPublishResultRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-pi-idem", "PI Idempotent Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-pi-idem", "tenant-pi-idem", "content", "published")

	now := time.Now().UTC()
	extID := "ext-idem"
	if err := publishRepo.Create(ctx, CreatePublishResultParams{
		ID:          "ppr-pi-idem",
		PostID:      "post-pi-idem",
		Platform:    "instagram_feed",
		Provider:    "meta",
		ExternalID:  &extID,
		Status:      "published",
		PublishedAt: &now,
	}); err != nil {
		t.Fatalf("create publish result: %v", err)
	}

	params := UpsertInsightParams{
		ID:              "pi-idem",
		PublishResultID: "ppr-pi-idem",
		PostID:          "post-pi-idem",
		Platform:        "instagram_feed",
		Window:          "24h",
		Metrics:         map[string]any{"impressions": 50},
		RawResponse:     map[string]any{},
	}

	if err := insightRepo.Upsert(ctx, params); err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	params.Metrics = map[string]any{"impressions": 200}
	if err := insightRepo.Upsert(ctx, params); err != nil {
		t.Fatalf("second upsert (update): %v", err)
	}

	list, err := insightRepo.ListByPostID(ctx, "post-pi-idem")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("len = %d, want 1 (upsert must not duplicate)", len(list))
	}
	if val, ok := list[0].Metrics["impressions"].(float64); !ok || val != 200 {
		t.Errorf("metrics.impressions = %v, want 200 (second upsert should update)", list[0].Metrics["impressions"])
	}
}

func TestPostInsightRepository_ListPendingSync_ByWindow(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	insightRepo := NewPostInsightRepository(sharedDB.Pool)
	publishRepo := NewPostPublishResultRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-pi-sync", "PI Sync Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-sync-24h", "tenant-pi-sync", "24h post", "published")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-sync-7d", "tenant-pi-sync", "7d post", "published")

	now := time.Now().UTC()
	pub24h := now.Add(-30 * time.Hour) // 30h ago → inside "24h" window (23h–48h)
	pub7d := now.Add(-8 * 24 * time.Hour) // 8d ago → inside "7d" window (6d–14d)

	ext24h := "ext-24h"
	if err := publishRepo.Create(ctx, CreatePublishResultParams{
		ID: "ppr-sync-24h", PostID: "post-sync-24h",
		Platform: "instagram_feed", Provider: "meta",
		ExternalID: &ext24h, Status: "published", PublishedAt: &pub24h,
	}); err != nil {
		t.Fatalf("create 24h result: %v", err)
	}

	ext7d := "ext-7d"
	if err := publishRepo.Create(ctx, CreatePublishResultParams{
		ID: "ppr-sync-7d", PostID: "post-sync-7d",
		Platform: "facebook", Provider: "meta",
		ExternalID: &ext7d, Status: "published", PublishedAt: &pub7d,
	}); err != nil {
		t.Fatalf("create 7d result: %v", err)
	}

	// "24h" window: publishedAfter = now-48h, publishedBefore = now-23h
	results24h, err := insightRepo.ListPendingSync(ctx, "24h", now.Add(-48*time.Hour), now.Add(-23*time.Hour))
	if err != nil {
		t.Fatalf("list pending 24h: %v", err)
	}
	if len(results24h) != 1 {
		t.Errorf("24h window: len = %d, want 1", len(results24h))
	} else if results24h[0].PostID != "post-sync-24h" {
		t.Errorf("24h window: post_id = %q, want post-sync-24h", results24h[0].PostID)
	}

	// "7d" window: publishedAfter = now-14d, publishedBefore = now-6d
	results7d, err := insightRepo.ListPendingSync(ctx, "7d", now.Add(-14*24*time.Hour), now.Add(-6*24*time.Hour))
	if err != nil {
		t.Fatalf("list pending 7d: %v", err)
	}
	if len(results7d) != 1 {
		t.Errorf("7d window: len = %d, want 1", len(results7d))
	} else if results7d[0].PostID != "post-sync-7d" {
		t.Errorf("7d window: post_id = %q, want post-sync-7d", results7d[0].PostID)
	}

	// After syncing the 24h result, it must disappear from pending
	if err := insightRepo.Upsert(ctx, UpsertInsightParams{
		ID:              "pi-sync-24h",
		PublishResultID: "ppr-sync-24h",
		PostID:          "post-sync-24h",
		Platform:        "instagram_feed",
		Window:          "24h",
		Metrics:         map[string]any{},
		RawResponse:     map[string]any{},
	}); err != nil {
		t.Fatalf("upsert insight: %v", err)
	}

	afterSync, err := insightRepo.ListPendingSync(ctx, "24h", now.Add(-48*time.Hour), now.Add(-23*time.Hour))
	if err != nil {
		t.Fatalf("list pending after sync: %v", err)
	}
	if len(afterSync) != 0 {
		t.Errorf("after sync: expected 0 pending results, got %d", len(afterSync))
	}
}
