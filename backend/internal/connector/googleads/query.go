package googleads

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
)

// QueryResult is a single row from a GAQL search response.
// Fields are nested maps mirroring the GAQL selector path (camelCase keys).
type QueryResult map[string]any

// Query executes a GAQL query and returns all rows, paginating up to 20 pages.
func (c *Client) Query(ctx context.Context, gaql string) ([]QueryResult, error) {
	var all []QueryResult
	var pageToken string

	for page := 0; page < 20; page++ {
		payload := map[string]any{"query": gaql}
		if pageToken != "" {
			payload["pageToken"] = pageToken
		}

		body, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}

		data, err := c.do(ctx, "POST",
			fmt.Sprintf("/customers/%s/googleAds:search", c.customerID),
			bytes.NewReader(body),
		)
		if err != nil {
			return nil, err
		}

		var resp struct {
			Results       []QueryResult `json:"results"`
			NextPageToken string        `json:"nextPageToken"`
		}
		if err := json.Unmarshal(data, &resp); err != nil {
			return nil, fmt.Errorf("query parse: %w", err)
		}

		all = append(all, resp.Results...)
		if resp.NextPageToken == "" {
			break
		}
		pageToken = resp.NextPageToken
	}
	return all, nil
}

// str safely extracts a string from a nested QueryResult using dot-path keys.
func str(row QueryResult, keys ...string) string {
	var cur any = map[string]any(row)
	for _, k := range keys {
		m, ok := cur.(map[string]any)
		if !ok {
			return ""
		}
		cur = m[k]
	}
	if cur == nil {
		return ""
	}
	switch v := cur.(type) {
	case string:
		return v
	case float64:
		return fmt.Sprintf("%.0f", v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// num safely extracts a float64 from a nested QueryResult.
func num(row QueryResult, keys ...string) float64 {
	var cur any = map[string]any(row)
	for _, k := range keys {
		m, ok := cur.(map[string]any)
		if !ok {
			return 0
		}
		cur = m[k]
	}
	switch v := cur.(type) {
	case float64:
		return v
	case string:
		var f float64
		fmt.Sscanf(v, "%f", &f)
		return f
	}
	return 0
}

// fromMicros converts micros to BRL float.
func fromMicros(m float64) float64 { return m / 1_000_000 }

// micros converts BRL float to micros int64.
func micros(brl float64) int64 { return int64(brl * 1_000_000) }
