package googleads

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
)

// MutateResponse contains the resource names of created/updated resources.
type MutateResponse struct {
	Results []struct {
		ResourceName string `json:"resourceName"`
	} `json:"results"`
	MutateOperationResponses []map[string]any `json:"mutateOperationResponses"`
}

// Mutate sends operations to a resource-specific mutate endpoint.
// endpoint example: "/customers/123/campaignCriteria:mutate"
func (c *Client) Mutate(ctx context.Context, endpoint string, operations []map[string]any) (*MutateResponse, error) {
	payload := map[string]any{"operations": operations}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	data, err := c.do(ctx, "POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	var resp MutateResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("mutate parse: %w", err)
	}
	return &resp, nil
}

// BatchMutate sends a googleAds:mutate request with mixed resource types.
// Used for add_campaign_extensions which creates assets and links them in one call.
func (c *Client) BatchMutate(ctx context.Context, mutateOps []map[string]any) (*MutateResponse, error) {
	payload := map[string]any{"mutateOperations": mutateOps}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	data, err := c.do(ctx, "POST",
		fmt.Sprintf("/customers/%s/googleAds:mutate", c.customerID),
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, err
	}

	var resp MutateResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("batch mutate parse: %w", err)
	}
	return &resp, nil
}

// rn builds a resource name string.
// rn("campaigns", "456") → "customers/7955095597/campaigns/456"
func (c *Client) rn(resourceType, id string) string {
	return fmt.Sprintf("customers/%s/%s/%s", c.customerID, resourceType, id)
}
