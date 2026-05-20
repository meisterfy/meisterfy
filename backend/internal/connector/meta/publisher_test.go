package meta

import (
	"context"
	"strings"
	"testing"

	"github.com/mkt-maestro/mkt-maestro/internal/connector/social"
	"github.com/mkt-maestro/mkt-maestro/internal/domain"
)

func resourceWith(metadata map[string]any) *domain.ConnectorResource {
	return &domain.ConnectorResource{
		ID:       "test-res",
		TenantID: "t1",
		Metadata: metadata,
	}
}

func postWithMedia(content string, path *string) *domain.Post {
	return &domain.Post{
		ID:       "post-1",
		TenantID: "t1",
		Content:  content,
		MediaPath: path,
	}
}

func strPtr(s string) *string { return &s }

// --- BuildCaption ---

func TestBuildCaption(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		post     *domain.Post
		contains []string
	}{
		{
			name: "title content and hashtags",
			post: &domain.Post{
				Title:    strPtr("My Title"),
				Content:  "Body text",
				Hashtags: []string{"#go", "#test"},
			},
			contains: []string{"My Title", "Body text", "#go", "#test"},
		},
		{
			name:     "no title",
			post:     &domain.Post{Content: "Body only", Hashtags: []string{"#a"}},
			contains: []string{"Body only", "#a"},
		},
		{
			name:     "no hashtags",
			post:     &domain.Post{Title: strPtr("T"), Content: "C"},
			contains: []string{"T", "C"},
		},
		{
			name:     "empty title not included",
			post:     &domain.Post{Title: strPtr(""), Content: "Only content"},
			contains: []string{"Only content"},
		},
		{
			name:     "hashtags joined with spaces",
			post:     &domain.Post{Content: "X", Hashtags: []string{"#a", "#b", "#c"}},
			contains: []string{"#a #b #c"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := BuildCaption(tt.post)
			for _, s := range tt.contains {
				if !strings.Contains(got, s) {
					t.Errorf("BuildCaption missing %q; full output: %q", s, got)
				}
			}
		})
	}
}

// --- Publish error paths (no HTTP call) ---

func TestMetaPublisher_Publish_MissingPageToken(t *testing.T) {
	t.Parallel()
	p := NewPublisher("http://localhost")
	res := resourceWith(map[string]any{})
	_, err := p.Publish(context.Background(), social.PlatformFacebook, res, postWithMedia("content", nil))
	if err == nil {
		t.Fatal("expected error for missing page_access_token, got nil")
	}
}

func TestMetaPublisher_Publish_UnsupportedPlatform(t *testing.T) {
	t.Parallel()
	p := NewPublisher("http://localhost")
	res := resourceWith(map[string]any{"page_access_token": "tok"})
	_, err := p.Publish(context.Background(), social.PlatformInstagramReel, res, postWithMedia("content", nil))
	if err == nil || !strings.Contains(err.Error(), "unsupported") {
		t.Fatalf("expected unsupported-platform error, got %v", err)
	}
}

func TestMetaPublisher_Publish_IGFeed_MissingIgUserID(t *testing.T) {
	t.Parallel()
	p := NewPublisher("http://localhost")
	res := resourceWith(map[string]any{"page_access_token": "tok"})
	path := "/media/img.jpg"
	_, err := p.Publish(context.Background(), social.PlatformInstagramFeed, res, postWithMedia("content", &path))
	if err == nil || !strings.Contains(err.Error(), "ig_user_id") {
		t.Fatalf("expected ig_user_id error, got %v", err)
	}
}

func TestMetaPublisher_Publish_IGFeed_MissingImage(t *testing.T) {
	t.Parallel()
	p := NewPublisher("http://localhost")
	res := resourceWith(map[string]any{"page_access_token": "tok", "ig_user_id": "ig-1"})
	_, err := p.Publish(context.Background(), social.PlatformInstagramFeed, res, postWithMedia("content", nil))
	if err == nil || !strings.Contains(err.Error(), "image") {
		t.Fatalf("expected image-required error, got %v", err)
	}
}

func TestMetaPublisher_Publish_IGStory_MissingIgUserID(t *testing.T) {
	t.Parallel()
	p := NewPublisher("http://localhost")
	res := resourceWith(map[string]any{"page_access_token": "tok"})
	path := "/media/img.jpg"
	_, err := p.Publish(context.Background(), social.PlatformInstagramStory, res, postWithMedia("content", &path))
	if err == nil || !strings.Contains(err.Error(), "ig_user_id") {
		t.Fatalf("expected ig_user_id error, got %v", err)
	}
}

func TestMetaPublisher_Publish_IGStory_MissingImage(t *testing.T) {
	t.Parallel()
	p := NewPublisher("http://localhost")
	res := resourceWith(map[string]any{"page_access_token": "tok", "ig_user_id": "ig-1"})
	_, err := p.Publish(context.Background(), social.PlatformInstagramStory, res, postWithMedia("content", nil))
	if err == nil || !strings.Contains(err.Error(), "image") {
		t.Fatalf("expected image-required error, got %v", err)
	}
}

// --- FetchInsights error paths (no HTTP call) ---

func TestMetaPublisher_FetchInsights_MissingPageToken(t *testing.T) {
	t.Parallel()
	p := NewPublisher("http://localhost")
	res := resourceWith(map[string]any{})
	_, err := p.FetchInsights(context.Background(), social.PlatformInstagramFeed, res, "ext-123")
	if err == nil {
		t.Fatal("expected error for missing page_access_token, got nil")
	}
}

func TestMetaPublisher_FetchInsights_UnsupportedPlatform(t *testing.T) {
	t.Parallel()
	p := NewPublisher("http://localhost")
	res := resourceWith(map[string]any{"page_access_token": "tok"})
	_, err := p.FetchInsights(context.Background(), social.PlatformInstagramReel, res, "ext-123")
	if err == nil || !strings.Contains(err.Error(), "unsupported") {
		t.Fatalf("expected unsupported-platform error, got %v", err)
	}
}

// --- Happy paths skipped (require live Meta API) ---

func TestMetaPublisher_Publish_IGFeed_Success(t *testing.T) {
	t.Parallel()
	t.Skip("requires live Meta API — set META_PAGE_ACCESS_TOKEN + META_IG_USER_ID to run locally")
}

func TestMetaPublisher_Publish_Facebook_Success(t *testing.T) {
	t.Parallel()
	t.Skip("requires live Meta API — set META_PAGE_ACCESS_TOKEN to run locally")
}

func TestMetaPublisher_FetchInsights_Success(t *testing.T) {
	t.Parallel()
	t.Skip("requires live Meta API — set META_PAGE_ACCESS_TOKEN to run locally")
}
