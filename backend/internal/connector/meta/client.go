package meta

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const graphAPIBase = "https://graph.facebook.com/v18.0"

// Client is a lightweight Meta Graph API client.
type Client struct {
	accessToken string
	httpClient  *http.Client
}

func NewClient(accessToken string) *Client {
	return &Client{
		accessToken: accessToken,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
	}
}

// Page represents a Facebook Page the user manages.
type Page struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	AccessToken string `json:"access_token"`
}

// IGAccount represents an Instagram Business account linked to a Page.
type IGAccount struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// GetAccounts returns Facebook Pages managed by the user.
func (c *Client) GetAccounts(ctx context.Context) ([]Page, error) {
	u := fmt.Sprintf("%s/me/accounts?access_token=%s&fields=id,name,access_token", graphAPIBase, url.QueryEscape(c.accessToken))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data   []Page `json:"data"`
		Error  *graphError `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode accounts: %w", err)
	}
	if result.Error != nil {
		return nil, result.Error
	}
	return result.Data, nil
}

// GetIGAccount returns the Instagram Business account linked to a Page.
func (c *Client) GetIGAccount(ctx context.Context, pageID, pageToken string) (*IGAccount, error) {
	u := fmt.Sprintf("%s/%s?fields=instagram_business_account{id,username}&access_token=%s", graphAPIBase, pageID, url.QueryEscape(pageToken))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		InstagramBusinessAccount *IGAccount `json:"instagram_business_account"`
		Error                     *graphError `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode ig account: %w", err)
	}
	if result.Error != nil {
		return nil, result.Error
	}
	if result.InstagramBusinessAccount == nil {
		return nil, nil
	}
	return result.InstagramBusinessAccount, nil
}

// CreateIGMediaContainer creates a single-image or carousel container.
// For carousel items, set isCarouselItem=true and omit caption.
func (c *Client) CreateIGMediaContainer(ctx context.Context, igUserID, imageURL, caption string, isCarouselItem bool) (string, error) {
	params := url.Values{
		"image_url":     {imageURL},
		"access_token":  {c.accessToken},
	}
	if !isCarouselItem {
		params.Set("caption", caption)
	} else {
		params.Set("is_carousel_item", "true")
	}

	u := fmt.Sprintf("%s/%s/media?%s", graphAPIBase, igUserID, params.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, nil)
	if err != nil {
		return "", err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		ID    string `json:"id"`
		Error *graphError `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode container: %w", err)
	}
	if result.Error != nil {
		return "", result.Error
	}
	return result.ID, nil
}

// CreateCarouselContainer creates a carousel container from child container IDs.
func (c *Client) CreateCarouselContainer(ctx context.Context, igUserID, children, caption string) (string, error) {
	params := url.Values{
		"media_type":    {"CAROUSEL"},
		"children":      {children},
		"caption":       {caption},
		"access_token":  {c.accessToken},
	}

	u := fmt.Sprintf("%s/%s/media?%s", graphAPIBase, igUserID, params.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, nil)
	if err != nil {
		return "", err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		ID    string `json:"id"`
		Error *graphError `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode carousel container: %w", err)
	}
	if result.Error != nil {
		return "", result.Error
	}
	return result.ID, nil
}

// PollContainerStatus waits until the container status is FINISHED (or failed).
func (c *Client) PollContainerStatus(ctx context.Context, containerID string) error {
	u := fmt.Sprintf("%s/%s?fields=status_code&access_token=%s", graphAPIBase, containerID, url.QueryEscape(c.accessToken))

	for i := 0; i < 20; i++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		if err != nil {
			return err
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return err
		}

		var result struct {
			StatusCode string `json:"status_code"`
			Error      *graphError `json:"error"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			resp.Body.Close()
			return fmt.Errorf("decode status: %w", err)
		}
		resp.Body.Close()

		if result.Error != nil {
			return result.Error
		}

		switch result.StatusCode {
		case "FINISHED":
			return nil
		case "ERROR", "EXPIRED":
			return fmt.Errorf("container %s failed with status %s", containerID, result.StatusCode)
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
	return fmt.Errorf("container %s did not finish in time", containerID)
}

// PublishIGMedia publishes a ready container.
func (c *Client) PublishIGMedia(ctx context.Context, igUserID, creationID string) (string, error) {
	params := url.Values{
		"creation_id":  {creationID},
		"access_token": {c.accessToken},
	}

	u := fmt.Sprintf("%s/%s/media_publish?%s", graphAPIBase, igUserID, params.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, nil)
	if err != nil {
		return "", err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		ID    string `json:"id"`
		Error *graphError `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode publish: %w", err)
	}
	if result.Error != nil {
		return "", result.Error
	}
	return result.ID, nil
}

// PostToPage publishes a message (and optional link) to a Facebook Page.
func (c *Client) PostToPage(ctx context.Context, pageID, message, link string) (string, error) {
	params := url.Values{
		"message":      {message},
		"access_token": {c.accessToken},
	}
	if link != "" {
		params.Set("link", link)
	}

	u := fmt.Sprintf("%s/%s/feed?%s", graphAPIBase, pageID, params.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, nil)
	if err != nil {
		return "", err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		ID    string `json:"id"`
		Error *graphError `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode page post: %w", err)
	}
	if result.Error != nil {
		return "", result.Error
	}
	return result.ID, nil
}

type graphError struct {
	Message   string `json:"message"`
	Type      string `json:"type"`
	Code      int    `json:"code"`
	ErrorSubcode int `json:"error_subcode"`
}

func (e *graphError) Error() string {
	return fmt.Sprintf("meta graph api error: %s (code=%d, subcode=%d)", e.Message, e.Code, e.ErrorSubcode)
}

// CreateIGStoryContainer creates an Instagram Story media container.
func (c *Client) CreateIGStoryContainer(ctx context.Context, igUserID, imageURL string) (string, error) {
	params := url.Values{
		"image_url":    {imageURL},
		"media_type":   {"STORIES"},
		"access_token": {c.accessToken},
	}

	u := fmt.Sprintf("%s/%s/media?%s", graphAPIBase, igUserID, params.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, nil)
	if err != nil {
		return "", err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		ID    string      `json:"id"`
		Error *graphError `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode story container: %w", err)
	}
	if result.Error != nil {
		return "", result.Error
	}
	return result.ID, nil
}

// GetIGMediaInsights fetches lifetime insights for a published Instagram media object.
// Returns the raw decoded response and a flat metrics map.
func (c *Client) GetIGMediaInsights(ctx context.Context, mediaID string) (map[string]any, map[string]any, error) {
	metrics := "impressions,reach,likes,comments,shares,saved"
	u := fmt.Sprintf("%s/%s/insights?metric=%s&access_token=%s", graphAPIBase, mediaID, metrics, url.QueryEscape(c.accessToken))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	var raw map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, nil, fmt.Errorf("decode ig insights: %w", err)
	}

	parsed := parseInsightData(raw)
	return raw, parsed, nil
}

// GetFBPostInsights fetches insights for a published Facebook page post.
// Requires the page access token (set at NewClient time).
func (c *Client) GetFBPostInsights(ctx context.Context, postID string) (map[string]any, map[string]any, error) {
	metrics := "post_impressions,post_reach,post_engaged_users,post_clicks"
	u := fmt.Sprintf("%s/%s/insights?metric=%s&access_token=%s", graphAPIBase, postID, metrics, url.QueryEscape(c.accessToken))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	var raw map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, nil, fmt.Errorf("decode fb insights: %w", err)
	}

	parsed := parseInsightData(raw)
	return raw, parsed, nil
}

// parseInsightData extracts a flat name→value map from a Graph API insights response.
// Expected shape: {"data": [{"name": "impressions", "values": [{"value": 100}]}]}
func parseInsightData(raw map[string]any) map[string]any {
	out := map[string]any{}
	data, _ := raw["data"].([]any)
	for _, item := range data {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := m["name"].(string)
		if name == "" {
			continue
		}
		// period=lifetime returns a single-element values array
		if vals, ok := m["values"].([]any); ok && len(vals) > 0 {
			if v, ok := vals[0].(map[string]any); ok {
				out[name] = v["value"]
				continue
			}
		}
		// fallback: use the "value" field directly
		out[name] = m["value"]
	}
	return out
}

// BuildMediaURL builds a public URL for a media file served by this server.
func BuildMediaURL(baseURL, tenantID, filename string) string {
	return strings.TrimSuffix(baseURL, "/") + "/api/media/" + tenantID + "/" + filename
}
