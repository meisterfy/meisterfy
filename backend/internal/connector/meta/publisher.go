package meta

import (
	"context"
	"fmt"
	"strings"

	"github.com/meisterfy/meisterfy/internal/connector/social"
	"github.com/meisterfy/meisterfy/internal/domain"
)

// Publisher implements social.Publisher for Meta platforms (Instagram + Facebook).
type Publisher struct {
	baseURL string
}

func NewPublisher(baseURL string) *Publisher {
	return &Publisher{baseURL: strings.TrimSuffix(baseURL, "/")}
}

func (p *Publisher) pageToken(resource *domain.ConnectorResource) (string, error) {
	if t, ok := resource.Metadata["page_access_token"].(string); ok && t != "" {
		return t, nil
	}
	return "", fmt.Errorf("resource %s has no page_access_token in metadata", resource.ID)
}

func (p *Publisher) Publish(ctx context.Context, platform social.Platform, resource *domain.ConnectorResource, post *domain.Post) (social.PublishResult, error) {
	token, err := p.pageToken(resource)
	if err != nil {
		return social.PublishResult{}, err
	}
	client := NewClient(token)
	caption := BuildCaption(post)

	switch platform {
	case social.PlatformInstagramFeed:
		return p.publishIGFeed(ctx, client, resource, post, caption)
	case social.PlatformInstagramStory:
		return p.publishIGStory(ctx, client, resource, post)
	case social.PlatformFacebook:
		return p.publishFacebook(ctx, client, resource, post, caption)
	default:
		return social.PublishResult{}, fmt.Errorf("unsupported platform: %s", platform)
	}
}

func (p *Publisher) publishIGFeed(ctx context.Context, client *Client, resource *domain.ConnectorResource, post *domain.Post, caption string) (social.PublishResult, error) {
	igMeta := resource.MetaMetadata()
	if igMeta.IgUserID == "" {
		return social.PublishResult{}, fmt.Errorf("resource %s has no ig_user_id", resource.ID)
	}
	imageURL := p.resolveMediaURL(post)
	if imageURL == "" {
		return social.PublishResult{}, fmt.Errorf("instagram feed posts require an image")
	}
	containerID, err := client.CreateIGMediaContainer(ctx, igMeta.IgUserID, imageURL, caption, false)
	if err != nil {
		return social.PublishResult{}, fmt.Errorf("create container: %w", err)
	}
	if err := client.PollContainerStatus(ctx, containerID); err != nil {
		return social.PublishResult{}, fmt.Errorf("container not ready: %w", err)
	}
	mediaID, err := client.PublishIGMedia(ctx, igMeta.IgUserID, containerID)
	if err != nil {
		return social.PublishResult{}, fmt.Errorf("publish media: %w", err)
	}
	return social.PublishResult{ExternalID: mediaID, Platform: social.PlatformInstagramFeed}, nil
}

func (p *Publisher) publishIGStory(ctx context.Context, client *Client, resource *domain.ConnectorResource, post *domain.Post) (social.PublishResult, error) {
	igMeta := resource.MetaMetadata()
	if igMeta.IgUserID == "" {
		return social.PublishResult{}, fmt.Errorf("resource %s has no ig_user_id", resource.ID)
	}
	imageURL := p.resolveMediaURL(post)
	if imageURL == "" {
		return social.PublishResult{}, fmt.Errorf("instagram story posts require an image")
	}
	containerID, err := client.CreateIGStoryContainer(ctx, igMeta.IgUserID, imageURL)
	if err != nil {
		return social.PublishResult{}, fmt.Errorf("create story container: %w", err)
	}
	if err := client.PollContainerStatus(ctx, containerID); err != nil {
		return social.PublishResult{}, fmt.Errorf("container not ready: %w", err)
	}
	mediaID, err := client.PublishIGMedia(ctx, igMeta.IgUserID, containerID)
	if err != nil {
		return social.PublishResult{}, fmt.Errorf("publish story: %w", err)
	}
	return social.PublishResult{ExternalID: mediaID, Platform: social.PlatformInstagramStory}, nil
}

func (p *Publisher) publishFacebook(ctx context.Context, client *Client, resource *domain.ConnectorResource, post *domain.Post, caption string) (social.PublishResult, error) {
	var link string
	if post.MediaPath != nil && *post.MediaPath != "" {
		link = p.resolveMediaURL(post)
	}
	postID, err := client.PostToPage(ctx, resource.ResourceID, caption, link)
	if err != nil {
		return social.PublishResult{}, fmt.Errorf("post to page: %w", err)
	}
	return social.PublishResult{ExternalID: postID, Platform: social.PlatformFacebook}, nil
}

func (p *Publisher) FetchInsights(ctx context.Context, platform social.Platform, resource *domain.ConnectorResource, externalID string) (map[string]any, error) {
	token, err := p.pageToken(resource)
	if err != nil {
		return nil, err
	}
	client := NewClient(token)

	switch platform {
	case social.PlatformInstagramFeed, social.PlatformInstagramStory:
		raw, metrics, err := client.GetIGMediaInsights(ctx, externalID)
		if err != nil {
			return nil, fmt.Errorf("ig insights: %w", err)
		}
		return map[string]any{"raw": raw, "metrics": metrics}, nil
	case social.PlatformFacebook:
		raw, metrics, err := client.GetFBPostInsights(ctx, externalID)
		if err != nil {
			return nil, fmt.Errorf("fb insights: %w", err)
		}
		return map[string]any{"raw": raw, "metrics": metrics}, nil
	default:
		return nil, fmt.Errorf("unsupported platform: %s", platform)
	}
}

func (p *Publisher) resolveMediaURL(post *domain.Post) string {
	if post.MediaPath == nil || *post.MediaPath == "" {
		return ""
	}
	return BuildMediaURL(p.baseURL, post.TenantID, *post.MediaPath)
}

// BuildCaption assembles the post caption: title + content + hashtags.
func BuildCaption(post *domain.Post) string {
	var b strings.Builder
	if post.Title != nil && *post.Title != "" {
		b.WriteString(*post.Title)
		b.WriteString("\n\n")
	}
	b.WriteString(post.Content)
	if len(post.Hashtags) > 0 {
		b.WriteString("\n\n")
		for i, h := range post.Hashtags {
			if i > 0 {
				b.WriteString(" ")
			}
			b.WriteString(h)
		}
	}
	return b.String()
}
