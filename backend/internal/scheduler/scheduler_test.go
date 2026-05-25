//go:build integration

package scheduler

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/meisterfy/meisterfy/internal/connector/social"
	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/internal/repository"
	"github.com/meisterfy/meisterfy/testutil"
)

// --- mock postRepo ---

type mockPostRepoSched struct {
	mu           sync.Mutex
	updateCalled bool
	lastStatus   string
	updateErr    error
}

func (m *mockPostRepoSched) ListDueScheduledPosts(_ context.Context) ([]*domain.Post, error) {
	return nil, nil
}

func (m *mockPostRepoSched) UpdateStatus(_ context.Context, _, _, status string, _ *time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.updateCalled = true
	m.lastStatus = status
	return m.updateErr
}

// --- fake publisher ---

type fakeMetaPublisher struct {
	failPlatforms map[social.Platform]bool
}

func (f *fakeMetaPublisher) Publish(_ context.Context, platform social.Platform, _ *domain.ConnectorResource, _ *domain.Post) (social.PublishResult, error) {
	if f.failPlatforms[platform] {
		return social.PublishResult{}, errors.New("simulated publish failure")
	}
	return social.PublishResult{ExternalID: "ext-" + string(platform), Platform: platform}, nil
}

func (f *fakeMetaPublisher) FetchInsights(_ context.Context, _ social.Platform, _ *domain.ConnectorResource, _ string) (map[string]any, error) {
	return map[string]any{"metrics": map[string]any{}, "raw": map[string]any{}}, nil
}

// --- helpers ---

func newSchedWith(postMock *mockPostRepoSched) *Scheduler {
	return &Scheduler{
		publishResultRepo: repository.NewPostPublishResultRepository(sharedDB.Pool),
		connResourceRepo:  repository.NewConnectorResourceRepository(sharedDB.Pool),
		postRepo:          postMock,
	}
}

func mustCreateMetaConnectorResource(ctx context.Context, t testing.TB, tenantID, resID string) {
	t.Helper()
	testutil.MustCreateIntegration(ctx, t, sharedDB.Pool, "ig-meta-"+resID, "Meta", "meta", "social", "connected")
	testutil.MustLinkIntegrationTenant(ctx, t, sharedDB.Pool, "ig-meta-"+resID, tenantID)
	res := &domain.ConnectorResource{
		ID:            resID,
		TenantID:      tenantID,
		IntegrationID: "ig-meta-" + resID,
		Provider:      domain.ProviderMeta,
		ResourceType:  "page",
		ResourceID:    "page-" + resID,
		ResourceName:  testutil.Ptr("Test Page"),
		Metadata:      map[string]any{"page_access_token": "tok", "ig_user_id": "ig-" + resID},
	}
	if err := repository.NewConnectorResourceRepository(sharedDB.Pool).Upsert(ctx, res); err != nil {
		t.Fatalf("mustCreateMetaConnectorResource %s: %v", resID, err)
	}
}

func registerFakeMeta(t testing.TB, pub *fakeMetaPublisher) {
	t.Helper()
	prev := social.Get(domain.ProviderMeta)
	social.Register(domain.ProviderMeta, pub)
	t.Cleanup(func() {
		if prev != nil {
			social.Register(domain.ProviderMeta, prev)
		}
	})
}

// --- tests ---

func TestPublishPost_DedupGuard(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-dedup", "Dedup Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-dedup", "t-dedup", "content", "scheduled")

	publishRepo := repository.NewPostPublishResultRepository(sharedDB.Pool)
	if err := publishRepo.Create(ctx, repository.CreatePublishResultParams{
		ID:       "ppr-dedup",
		PostID:   "post-dedup",
		Platform: "instagram_feed",
		Provider: "meta",
		Status:   "published",
	}); err != nil {
		t.Fatalf("create existing result: %v", err)
	}

	mock := &mockPostRepoSched{}
	s := newSchedWith(mock)

	post := &domain.Post{ID: "post-dedup", TenantID: "t-dedup", Platforms: []string{"instagram_feed"}}
	s.publishPost(ctx, post)

	mock.mu.Lock()
	called := mock.updateCalled
	mock.mu.Unlock()

	if called {
		t.Error("UpdateStatus must not be called when publish result already exists (dedup guard)")
	}

	results, _ := publishRepo.ListByPostID(ctx, "post-dedup")
	if len(results) != 1 {
		t.Errorf("expected 1 result (pre-existing), got %d", len(results))
	}
}

func TestPublishPost_NoKnownPlatforms(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-noplat", "No Platforms Tenant")

	mock := &mockPostRepoSched{}
	s := newSchedWith(mock)

	post := &domain.Post{
		ID:        "post-noplat",
		TenantID:  "t-noplat",
		Platforms: []string{"tiktok", "snapchat"}, // not in PlatformProvider
	}
	s.publishPost(ctx, post)

	mock.mu.Lock()
	status := mock.lastStatus
	mock.mu.Unlock()

	if status != string(domain.PostStatusFailed) {
		t.Errorf("status = %q, want %q", status, domain.PostStatusFailed)
	}
}

func TestPublishPost_NoResource(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-nores", "No Resource Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-nores", "t-nores", "content", "scheduled")

	mock := &mockPostRepoSched{}
	s := newSchedWith(mock)

	post := &domain.Post{
		ID:        "post-nores",
		TenantID:  "t-nores",
		Platforms: []string{"instagram_feed"},
	}
	s.publishPost(ctx, post)

	mock.mu.Lock()
	status := mock.lastStatus
	mock.mu.Unlock()

	if status != string(domain.PostStatusFailed) {
		t.Errorf("status = %q, want %q", status, domain.PostStatusFailed)
	}

	publishRepo := repository.NewPostPublishResultRepository(sharedDB.Pool)
	results, _ := publishRepo.ListByPostID(ctx, "post-nores")
	if len(results) != 1 {
		t.Fatalf("expected 1 failed result, got %d", len(results))
	}
	if results[0].Status != "failed" {
		t.Errorf("result status = %q, want failed", results[0].Status)
	}
	if results[0].ErrorMessage == nil || *results[0].ErrorMessage == "" {
		t.Error("expected non-empty error_message in failed result")
	}
}

func TestPublishPost_ProviderNotRegistered(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()

	const unregPlatform = social.Platform("test_sched_unreg_plat")
	const unregProvider = domain.IntegrationProvider("test_sched_unreg_prov")

	social.PlatformProvider[unregPlatform] = unregProvider
	t.Cleanup(func() { delete(social.PlatformProvider, unregPlatform) })

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-unreg", "Unreg Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-unreg", "t-unreg", "content", "scheduled")

	testutil.MustCreateIntegration(ctx, t, sharedDB.Pool, "ig-unreg", "Unreg", "test_sched_unreg_prov", "social", "connected")
	testutil.MustLinkIntegrationTenant(ctx, t, sharedDB.Pool, "ig-unreg", "t-unreg")
	if err := repository.NewConnectorResourceRepository(sharedDB.Pool).Upsert(ctx, &domain.ConnectorResource{
		ID:            "cr-unreg",
		TenantID:      "t-unreg",
		IntegrationID: "ig-unreg",
		Provider:      unregProvider,
		ResourceType:  "page",
		ResourceID:    "page-unreg",
		Metadata:      map[string]any{},
	}); err != nil {
		t.Fatalf("create connector resource: %v", err)
	}

	mock := &mockPostRepoSched{}
	s := newSchedWith(mock)

	post := &domain.Post{
		ID:        "post-unreg",
		TenantID:  "t-unreg",
		Platforms: []string{string(unregPlatform)},
	}
	s.publishPost(ctx, post)

	mock.mu.Lock()
	status := mock.lastStatus
	mock.mu.Unlock()

	if status != string(domain.PostStatusFailed) {
		t.Errorf("status = %q, want %q", status, domain.PostStatusFailed)
	}

	results, _ := repository.NewPostPublishResultRepository(sharedDB.Pool).ListByPostID(ctx, "post-unreg")
	if len(results) != 1 || results[0].Status != "failed" {
		t.Errorf("expected 1 failed result, got %v", results)
	}
}

func TestPublishPost_Success(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-ok", "OK Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-ok", "t-ok", "content", "scheduled")
	mustCreateMetaConnectorResource(ctx, t, "t-ok", "cr-ok")

	pub := &fakeMetaPublisher{}
	registerFakeMeta(t, pub)

	mock := &mockPostRepoSched{}
	s := newSchedWith(mock)

	post := &domain.Post{
		ID:        "post-ok",
		TenantID:  "t-ok",
		Platforms: []string{"instagram_feed"},
	}
	s.publishPost(ctx, post)

	mock.mu.Lock()
	status := mock.lastStatus
	mock.mu.Unlock()

	if status != string(domain.PostStatusPublished) {
		t.Errorf("status = %q, want %q", status, domain.PostStatusPublished)
	}

	results, _ := repository.NewPostPublishResultRepository(sharedDB.Pool).ListByPostID(ctx, "post-ok")
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Status != "published" {
		t.Errorf("result status = %q, want published", results[0].Status)
	}
	if results[0].ExternalID == nil || *results[0].ExternalID != fmt.Sprintf("ext-%s", social.PlatformInstagramFeed) {
		t.Errorf("external_id = %v, want ext-instagram_feed", results[0].ExternalID)
	}
}

func TestPublishPost_PartialFailure(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-partial", "Partial Tenant")
	testutil.MustCreatePost(ctx, t, sharedDB.Pool, "post-partial", "t-partial", "content", "scheduled")
	mustCreateMetaConnectorResource(ctx, t, "t-partial", "cr-partial")

	pub := &fakeMetaPublisher{failPlatforms: map[social.Platform]bool{social.PlatformInstagramStory: true}}
	registerFakeMeta(t, pub)

	mock := &mockPostRepoSched{}
	s := newSchedWith(mock)

	post := &domain.Post{
		ID:        "post-partial",
		TenantID:  "t-partial",
		Platforms: []string{"instagram_feed", "instagram_story"},
	}
	s.publishPost(ctx, post)

	mock.mu.Lock()
	status := mock.lastStatus
	mock.mu.Unlock()

	if status != string(domain.PostStatusPartiallyPublished) {
		t.Errorf("status = %q, want %q", status, domain.PostStatusPartiallyPublished)
	}

	results, _ := repository.NewPostPublishResultRepository(sharedDB.Pool).ListByPostID(ctx, "post-partial")
	if len(results) != 2 {
		t.Fatalf("expected 2 results (one per platform), got %d", len(results))
	}

	var published, failed int
	for _, r := range results {
		if r.Status == "published" {
			published++
		} else if r.Status == "failed" {
			failed++
		}
	}
	if published != 1 || failed != 1 {
		t.Errorf("published=%d failed=%d, want published=1 failed=1", published, failed)
	}
}
