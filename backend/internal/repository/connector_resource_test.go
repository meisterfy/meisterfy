//go:build integration

package repository

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/meisterfy/meisterfy/internal/domain"
	"github.com/meisterfy/meisterfy/testutil"
)

func TestConnectorResourceRepository_UpsertAndGetByID(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewConnectorResourceRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-cr", "CR Tenant")
	testutil.MustCreateIntegration(ctx, t, sharedDB.Pool, "ig-cr", "Google Ads", "google_ads", "ads", "pending")

	res := &domain.ConnectorResource{
		ID:            "cr-1",
		TenantID:      "t-cr",
		IntegrationID: "ig-cr",
		Provider:      domain.ProviderGoogleAds,
		ResourceType:  "campaign",
		ResourceID:    "ext-camp-1",
		Metadata:      map[string]any{"budget": 100},
	}
	if err := repo.Upsert(ctx, res); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	got, err := repo.GetByID(ctx, "cr-1")
	if err != nil {
		t.Fatalf("get by id: %v", err)
	}
	if got.ResourceID != "ext-camp-1" {
		t.Errorf("resourceID=%q, want ext-camp-1", got.ResourceID)
	}
	if got.Provider != domain.ProviderGoogleAds {
		t.Errorf("provider=%q, want google_ads", got.Provider)
	}
}

func TestConnectorResourceRepository_GetByID_NotFound(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewConnectorResourceRepository(sharedDB.Pool)

	_, err := repo.GetByID(ctx, "cr-nonexistent")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestConnectorResourceRepository_Upsert_UpdatesOnConflict(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewConnectorResourceRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-cr-upd", "CR Update Tenant")
	testutil.MustCreateIntegration(ctx, t, sharedDB.Pool, "ig-cr-upd", "Google Ads", "google_ads", "ads", "pending")

	res := &domain.ConnectorResource{
		ID:            "cr-upd-1",
		TenantID:      "t-cr-upd",
		IntegrationID: "ig-cr-upd",
		Provider:      domain.ProviderGoogleAds,
		ResourceType:  "campaign",
		ResourceID:    "ext-upd",
		Metadata:      map[string]any{"budget": 50},
	}
	if err := repo.Upsert(ctx, res); err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Same (tenant_id, integration_id, resource_type, resource_id) → DO UPDATE
	name := "Updated Name"
	res.ResourceName = &name
	res.Metadata = map[string]any{"budget": 200}
	if err := repo.Upsert(ctx, res); err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	got, err := repo.GetByID(ctx, "cr-upd-1")
	if err != nil {
		t.Fatalf("get after upsert: %v", err)
	}
	if got.ResourceName == nil || *got.ResourceName != "Updated Name" {
		t.Errorf("resourceName=%v, want 'Updated Name'", got.ResourceName)
	}
}

func TestConnectorResourceRepository_List(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewConnectorResourceRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-cr-list", "CR List Tenant")
	testutil.MustCreateIntegration(ctx, t, sharedDB.Pool, "ig-cr-list", "Google Ads", "google_ads", "ads", "pending")

	for i := 0; i < 3; i++ {
		if err := repo.Upsert(ctx, &domain.ConnectorResource{
			ID:            fmt.Sprintf("cr-list-%d", i),
			TenantID:      "t-cr-list",
			IntegrationID: "ig-cr-list",
			Provider:      domain.ProviderGoogleAds,
			ResourceType:  "campaign",
			ResourceID:    fmt.Sprintf("ext-%d", i),
		}); err != nil {
			t.Fatalf("upsert %d: %v", i, err)
		}
	}

	resources, err := repo.List(ctx, "t-cr-list", domain.ProviderGoogleAds, "campaign")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(resources) != 3 {
		t.Errorf("len=%d, want 3", len(resources))
	}
}

func TestConnectorResourceRepository_Delete(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewConnectorResourceRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-cr-del", "CR Delete Tenant")
	testutil.MustCreateIntegration(ctx, t, sharedDB.Pool, "ig-cr-del", "Google Ads", "google_ads", "ads", "pending")

	if err := repo.Upsert(ctx, &domain.ConnectorResource{
		ID:            "cr-del-1",
		TenantID:      "t-cr-del",
		IntegrationID: "ig-cr-del",
		Provider:      domain.ProviderGoogleAds,
		ResourceType:  "campaign",
		ResourceID:    "ext-del",
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	if err := repo.Delete(ctx, "cr-del-1"); err != nil {
		t.Fatalf("delete: %v", err)
	}

	_, err := repo.GetByID(ctx, "cr-del-1")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound after delete, got %v", err)
	}
}

func TestConnectorResourceRepository_DeleteByTenantProvider(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewConnectorResourceRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-cr-dbtp", "CR DBTP Tenant")
	testutil.MustCreateIntegration(ctx, t, sharedDB.Pool, "ig-gads-dbtp", "Google Ads", "google_ads", "ads", "pending")
	testutil.MustCreateIntegration(ctx, t, sharedDB.Pool, "ig-meta-dbtp", "Meta", "meta", "social_media", "pending")

	if err := repo.Upsert(ctx, &domain.ConnectorResource{
		ID:            "cr-dbtp-gads",
		TenantID:      "t-cr-dbtp",
		IntegrationID: "ig-gads-dbtp",
		Provider:      domain.ProviderGoogleAds,
		ResourceType:  "campaign",
		ResourceID:    "ext-gads",
	}); err != nil {
		t.Fatalf("upsert google_ads: %v", err)
	}

	if err := repo.Upsert(ctx, &domain.ConnectorResource{
		ID:            "cr-dbtp-meta",
		TenantID:      "t-cr-dbtp",
		IntegrationID: "ig-meta-dbtp",
		Provider:      domain.ProviderMeta,
		ResourceType:  "page",
		ResourceID:    "ext-meta",
	}); err != nil {
		t.Fatalf("upsert meta: %v", err)
	}

	// Delete only google_ads resources for this tenant
	if err := repo.DeleteByTenantProvider(ctx, "t-cr-dbtp", domain.ProviderGoogleAds); err != nil {
		t.Fatalf("delete by tenant+provider: %v", err)
	}

	_, err := repo.GetByID(ctx, "cr-dbtp-gads")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for deleted google_ads resource, got %v", err)
	}

	// Meta resource must still exist
	got, err := repo.GetByID(ctx, "cr-dbtp-meta")
	if err != nil {
		t.Fatalf("get meta: %v", err)
	}
	if got.Provider != domain.ProviderMeta {
		t.Errorf("meta provider=%q, want meta", got.Provider)
	}
}
