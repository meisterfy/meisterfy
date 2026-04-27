package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/rush-maestro/rush-maestro/internal/domain"
)

type OAuthGoogleAdsHandler struct {
	repo interface {
		GetByID(ctx context.Context, id string) (*domain.Integration, error)
		Update(ctx context.Context, ig *domain.Integration) error
	}
	baseURL string
}

func NewOAuthGoogleAdsHandler(
	repo interface {
		GetByID(ctx context.Context, id string) (*domain.Integration, error)
		Update(ctx context.Context, ig *domain.Integration) error
	},
	baseURL string,
) *OAuthGoogleAdsHandler {
	return &OAuthGoogleAdsHandler{repo: repo, baseURL: baseURL}
}

type oauthState struct {
	IntegrationID string `json:"integration_id"`
	ReturnTo      string `json:"return_to"`
}

func encodeOAuthState(s oauthState) string {
	b, _ := json.Marshal(s)
	return base64.URLEncoding.EncodeToString(b)
}

func decodeOAuthState(s string) (oauthState, error) {
	b, err := base64.URLEncoding.DecodeString(s)
	if err != nil {
		return oauthState{}, err
	}
	var st oauthState
	return st, json.Unmarshal(b, &st)
}

// GET /auth/google-ads/start?integration_id=xxx
func (h *OAuthGoogleAdsHandler) Start(w http.ResponseWriter, r *http.Request) {
	integrationID := r.URL.Query().Get("integration_id")
	if integrationID == "" {
		Error(w, http.StatusBadRequest, "integration_id is required")
		return
	}

	ig, err := h.repo.GetByID(r.Context(), integrationID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			NotFound(w)
			return
		}
		InternalError(w)
		return
	}

	if ig.OAuthClientID == nil || ig.OAuthClientSecret == nil {
		Error(w, http.StatusBadRequest, "integration credentials (Client ID and Secret) are not configured")
		return
	}

	state := encodeOAuthState(oauthState{
		IntegrationID: integrationID,
		ReturnTo:      "/settings/integrations",
	})

	params := url.Values{
		"client_id":     {*ig.OAuthClientID},
		"redirect_uri":  {h.baseURL + "/auth/google-ads/callback"},
		"response_type": {"code"},
		"scope":         {"https://www.googleapis.com/auth/adwords"},
		"access_type":   {"offline"},
		"prompt":        {"consent"},
		"state":         {state},
	}

	http.Redirect(w, r, "https://accounts.google.com/o/oauth2/v2/auth?"+params.Encode(), http.StatusFound)
}

// GET /auth/google-ads/callback
func (h *OAuthGoogleAdsHandler) Callback(w http.ResponseWriter, r *http.Request) {
	if oauthErr := r.URL.Query().Get("error"); oauthErr != "" {
		h.htmlError(w, "OAuth Error", oauthErr)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		h.htmlError(w, "Missing Code", "No authorization code received from Google.")
		return
	}

	state, err := decodeOAuthState(r.URL.Query().Get("state"))
	if err != nil || state.IntegrationID == "" {
		h.htmlError(w, "Invalid State", "Could not parse OAuth state parameter.")
		return
	}

	ig, err := h.repo.GetByID(r.Context(), state.IntegrationID)
	if err != nil || ig.OAuthClientID == nil || ig.OAuthClientSecret == nil {
		h.htmlError(w, "Integration Not Found", "The integration was deleted or credentials are missing.")
		return
	}

	refreshToken, err := exchangeGoogleCode(r.Context(), exchangeParams{
		Code:         code,
		ClientID:     *ig.OAuthClientID,
		ClientSecret: *ig.OAuthClientSecret,
		RedirectURI:  h.baseURL + "/auth/google-ads/callback",
	})
	if err != nil {
		msg := err.Error()
		ig.Status = domain.StatusError
		ig.ErrorMessage = &msg
		_ = h.repo.Update(r.Context(), ig)
		h.htmlError(w, "Token Exchange Failed", msg)
		return
	}

	ig.RefreshToken = &refreshToken
	ig.Status = domain.StatusConnected
	ig.ErrorMessage = nil
	if err := h.repo.Update(r.Context(), ig); err != nil {
		InternalError(w)
		return
	}

	returnTo := state.ReturnTo
	if returnTo == "" {
		returnTo = "/settings/integrations"
	}
	http.Redirect(w, r, returnTo+"?connected=1", http.StatusFound)
}

func (h *OAuthGoogleAdsHandler) htmlError(w http.ResponseWriter, title, detail string) {
	safe := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;").Replace(detail)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusBadRequest)
	fmt.Fprintf(w, `<!doctype html><html><head><meta charset="utf-8"><title>%s</title>
<style>body{font-family:sans-serif;max-width:640px;margin:60px auto;padding:20px;line-height:1.6}</style>
</head><body><h1>❌ %s</h1><p>%s</p></body></html>`, title, title, safe)
}

type exchangeParams struct {
	Code         string
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

type tokenResponse struct {
	RefreshToken    string `json:"refresh_token"`
	Error           string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

func exchangeGoogleCode(ctx context.Context, p exchangeParams) (string, error) {
	body := url.Values{
		"code":          {p.Code},
		"client_id":     {p.ClientID},
		"client_secret": {p.ClientSecret},
		"redirect_uri":  {p.RedirectURI},
		"grant_type":    {"authorization_code"},
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
		return "", err
	}
	defer resp.Body.Close()

	var tok tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return "", fmt.Errorf("failed to decode token response")
	}

	if tok.RefreshToken == "" {
		detail := tok.ErrorDescription
		if detail == "" {
			detail = tok.Error
		}
		if detail == "" {
			detail = "no refresh_token returned; if already authorized, revoke access at myaccount.google.com/permissions and try again"
		}
		return "", fmt.Errorf("%s", detail)
	}

	return tok.RefreshToken, nil
}
