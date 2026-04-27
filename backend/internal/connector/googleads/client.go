package googleads

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/rush-maestro/rush-maestro/internal/domain"
)

const adsAPIBase = "https://googleads.googleapis.com/v23"

type Client struct {
	creds      domain.GoogleAdsCreds
	customerID string // numeric, no dashes

	mu          sync.Mutex
	accessToken string
	tokenExpiry time.Time
}

// NewClient creates a Google Ads client for a specific customer account.
// customerID may contain dashes — they are stripped automatically.
func NewClient(customerID string, creds domain.GoogleAdsCreds) *Client {
	return &Client{
		creds:      creds,
		customerID: strings.ReplaceAll(customerID, "-", ""),
	}
}

func (c *Client) accessTokenFresh(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.accessToken != "" && time.Now().Before(c.tokenExpiry.Add(-30*time.Second)) {
		return c.accessToken, nil
	}
	return c.refresh(ctx)
}

func (c *Client) refresh(ctx context.Context) (string, error) {
	body := url.Values{
		"client_id":     {c.creds.ClientID},
		"client_secret": {c.creds.ClientSecret},
		"refresh_token": {c.creds.RefreshToken},
		"grant_type":    {"refresh_token"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://oauth2.googleapis.com/token",
		strings.NewReader(body.Encode()),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("token refresh: %w", err)
	}
	defer resp.Body.Close()

	var tok struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return "", fmt.Errorf("token decode: %w", err)
	}
	if tok.Error != "" {
		return "", fmt.Errorf("token error: %s — %s", tok.Error, tok.ErrorDesc)
	}
	c.accessToken = tok.AccessToken
	c.tokenExpiry = time.Now().Add(time.Duration(tok.ExpiresIn) * time.Second)
	return c.accessToken, nil
}

func (c *Client) headers(ctx context.Context) (http.Header, error) {
	token, err := c.accessTokenFresh(ctx)
	if err != nil {
		return nil, err
	}
	h := http.Header{}
	h.Set("Authorization", "Bearer "+token)
	h.Set("developer-token", c.creds.DeveloperToken)
	h.Set("Content-Type", "application/json")
	if c.creds.LoginCustomerID != "" {
		h.Set("login-customer-id", strings.ReplaceAll(c.creds.LoginCustomerID, "-", ""))
	}
	return h, nil
}

func (c *Client) do(ctx context.Context, method, path string, body io.Reader) ([]byte, error) {
	headers, err := c.headers(ctx)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, method, adsAPIBase+path, body)
	if err != nil {
		return nil, err
	}
	req.Header = headers

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("google ads api: %w", err)
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("google ads api %d: %s", resp.StatusCode, string(b))
	}
	return b, nil
}
