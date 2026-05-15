//go:build integration

package repository

import (
	"context"
	"testing"

	"github.com/rush-maestro/rush-maestro/internal/domain"
	"github.com/rush-maestro/rush-maestro/testutil"
)

func TestIntegrationRepository_CreateAndGet(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewIntegrationRepository(sharedDB.Pool, nil)

	ig := testutil.NewTestIntegration("ig-1", "Google Ads", domain.ProviderGoogleAds)
	if err := repo.Create(ctx, ig); err != nil {
		t.Fatalf("create integration: %v", err)
	}

	got, err := repo.GetByID(ctx, "ig-1")
	if err != nil {
		t.Fatalf("get by id: %v", err)
	}
	if got.Name != "Google Ads" {
		t.Errorf("name = %q, want %q", got.Name, "Google Ads")
	}
	if got.Provider != domain.ProviderGoogleAds {
		t.Errorf("provider = %q, want %q", got.Provider, domain.ProviderGoogleAds)
	}
}

func TestIntegrationRepository_List(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewIntegrationRepository(sharedDB.Pool, nil)

	testutil.MustCreateIntegration(ctx, t, sharedDB.Pool, "ig-2", "Meta", "meta", "social_media", "pending")
	testutil.MustCreateIntegration(ctx, t, sharedDB.Pool, "ig-3", "S3", "s3", "media", "pending")

	list, err := repo.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) < 2 {
		t.Errorf("len(list) = %d, want >= 2", len(list))
	}
}

func TestIntegrationRepository_SetTenants(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewIntegrationRepository(sharedDB.Pool, nil)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "tenant-ig", "Integration Tenant")
	testutil.MustCreateIntegration(ctx, t, sharedDB.Pool, "ig-4", "Claude", "claude", "llm", "pending")

	if err := repo.SetTenants(ctx, "ig-4", []string{"tenant-ig"}); err != nil {
		t.Fatalf("set tenants: %v", err)
	}

	got, err := repo.GetByID(ctx, "ig-4")
	if err != nil {
		t.Fatalf("get by id after set tenants: %v", err)
	}
	if len(got.TenantIDs) != 1 || got.TenantIDs[0] != "tenant-ig" {
		t.Errorf("tenantIDs = %v, want [tenant-ig]", got.TenantIDs)
	}
}

func TestIntegrationRepository_ConfigEncryptRoundTrip(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	key := []byte("12345678901234567890123456789012") // 32-byte key
	repo := NewIntegrationRepository(sharedDB.Pool, key)

	ig := testutil.NewTestIntegration("ig-enc-1", "OpenAI", domain.ProviderOpenAI)
	ig.Config = map[string]any{"api_key": "sk-secret-value"}

	if err := repo.Create(ctx, ig); err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := repo.GetByID(ctx, "ig-enc-1")
	if err != nil {
		t.Fatalf("get by id: %v", err)
	}
	val, ok := got.Config["api_key"]
	if !ok {
		t.Fatal("config missing api_key after decrypt")
	}
	if val != "sk-secret-value" {
		t.Errorf("api_key = %q, want %q", val, "sk-secret-value")
	}
}

func TestIntegrationRepository_ConfigLegacyPlaintextFallback(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()

	// Write with no key (plaintext)
	repoNoKey := NewIntegrationRepository(sharedDB.Pool, nil)
	ig := testutil.NewTestIntegration("ig-enc-2", "Claude", domain.ProviderClaude)
	ig.Config = map[string]any{"api_key": "anth-plain"}
	if err := repoNoKey.Create(ctx, ig); err != nil {
		t.Fatalf("create (no key): %v", err)
	}

	// Read with a key — should fall back gracefully to plain JSON
	key := []byte("12345678901234567890123456789012")
	repoWithKey := NewIntegrationRepository(sharedDB.Pool, key)
	got, err := repoWithKey.GetByID(ctx, "ig-enc-2")
	if err != nil {
		t.Fatalf("get by id (with key, legacy row): %v", err)
	}
	if got.Config["api_key"] != "anth-plain" {
		t.Errorf("api_key = %q, want %q", got.Config["api_key"], "anth-plain")
	}
}

func TestIntegrationRepository_UpdateAndDelete(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewIntegrationRepository(sharedDB.Pool, nil)

	ig := testutil.NewTestIntegration("ig-5", "OpenAI", domain.ProviderOpenAI)
	if err := repo.Create(ctx, ig); err != nil {
		t.Fatalf("create: %v", err)
	}

	ig.Name = "OpenAI Updated"
	ig.Status = domain.StatusConnected
	if err := repo.Update(ctx, ig); err != nil {
		t.Fatalf("update: %v", err)
	}

	got, err := repo.GetByID(ctx, "ig-5")
	if err != nil {
		t.Fatalf("get after update: %v", err)
	}
	if got.Name != "OpenAI Updated" {
		t.Errorf("name = %q, want %q", got.Name, "OpenAI Updated")
	}
	if got.Status != domain.StatusConnected {
		t.Errorf("status = %q, want %q", got.Status, domain.StatusConnected)
	}

	if err := repo.Delete(ctx, "ig-5"); err != nil {
		t.Fatalf("delete: %v", err)
	}

	_, err = repo.GetByID(ctx, "ig-5")
	if err == nil {
		t.Error("expected error after delete, got nil")
	}
}
