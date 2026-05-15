//go:build integration

package repository

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/mkt-maestro/mkt-maestro/testutil"
)

func TestMetricsRepository_UpsertAndGetHistory(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewMetricsRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-metrics", "Metrics Tenant")

	date := time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC)
	m := DailyMetric{
		ID:           "dm-1",
		TenantID:     "t-metrics",
		Date:         date,
		CampaignID:   "camp-m1",
		CampaignName: "Summer Sale",
		Impressions:  1000,
		Clicks:       50,
		CostBRL:      100.0,
		Conversions:  5.0,
	}
	if err := repo.UpsertDaily(ctx, m); err != nil {
		t.Fatalf("upsert daily: %v", err)
	}

	history, err := repo.GetHistory(ctx, "t-metrics", date.Add(-24*time.Hour))
	if err != nil {
		t.Fatalf("get history: %v", err)
	}
	if len(history) != 1 {
		t.Fatalf("len(history)=%d, want 1", len(history))
	}
	if history[0].Impressions != 1000 {
		t.Errorf("impressions=%d, want 1000", history[0].Impressions)
	}
	if history[0].Clicks != 50 {
		t.Errorf("clicks=%d, want 50", history[0].Clicks)
	}
	if history[0].CampaignID != "camp-m1" {
		t.Errorf("campaignID=%q, want camp-m1", history[0].CampaignID)
	}
}

func TestMetricsRepository_UpsertDaily_UpdatesOnConflict(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewMetricsRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-metrics-up", "Metrics Update Tenant")

	date := time.Date(2025, 2, 1, 0, 0, 0, 0, time.UTC)
	m := DailyMetric{
		ID:           "dm-upd",
		TenantID:     "t-metrics-up",
		Date:         date,
		CampaignID:   "camp-upd",
		CampaignName: "Campaign",
		Impressions:  100,
		Clicks:       10,
		CostBRL:      20.0,
		Conversions:  1.0,
	}
	if err := repo.UpsertDaily(ctx, m); err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Same (tenant_id, date, campaign_id) → ON CONFLICT DO UPDATE
	m.Impressions = 200
	m.Clicks = 20
	if err := repo.UpsertDaily(ctx, m); err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	history, err := repo.GetHistory(ctx, "t-metrics-up", date.Add(-time.Hour))
	if err != nil {
		t.Fatalf("get history: %v", err)
	}
	if len(history) != 1 {
		t.Fatalf("len=%d, want 1 (upsert must not duplicate)", len(history))
	}
	if history[0].Impressions != 200 {
		t.Errorf("impressions=%d, want 200 after upsert update", history[0].Impressions)
	}
}

func TestMetricsRepository_GetHistory_FiltersByDate(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewMetricsRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-metrics-dt", "Metrics Date Tenant")

	base := time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 5; i++ {
		m := DailyMetric{
			ID:           fmt.Sprintf("dm-dt-%d", i),
			TenantID:     "t-metrics-dt",
			Date:         base.AddDate(0, 0, i),
			CampaignID:   "camp-dt",
			CampaignName: "Campaign",
			Impressions:  int32(i * 100),
		}
		if err := repo.UpsertDaily(ctx, m); err != nil {
			t.Fatalf("upsert day %d: %v", i, err)
		}
	}

	// since = day 3 (March 4) → expect 2 records: day 3 and day 4
	since := base.AddDate(0, 0, 3)
	history, err := repo.GetHistory(ctx, "t-metrics-dt", since)
	if err != nil {
		t.Fatalf("get history: %v", err)
	}
	if len(history) != 2 {
		t.Errorf("len=%d, want 2 (records on or after March 4)", len(history))
	}
}

func TestMetricsRepository_UpsertAndGetMonthlySummary(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewMetricsRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-metrics-mo", "Metrics Monthly Tenant")

	m := MonthlySummary{
		ID:           "ms-1",
		TenantID:     "t-metrics-mo",
		Month:        "2025-01",
		CampaignID:   "camp-mo",
		CampaignName: "Monthly Camp",
		Impressions:  5000,
		Clicks:       250,
		CostBRL:      500.0,
		Conversions:  25.0,
	}
	if err := repo.UpsertMonthly(ctx, m); err != nil {
		t.Fatalf("upsert monthly: %v", err)
	}

	summaries, err := repo.GetMonthlySummary(ctx, "t-metrics-mo", 10)
	if err != nil {
		t.Fatalf("get monthly summary: %v", err)
	}
	if len(summaries) != 1 {
		t.Fatalf("len=%d, want 1", len(summaries))
	}
	if summaries[0].Month != "2025-01" {
		t.Errorf("month=%q, want 2025-01", summaries[0].Month)
	}
	if summaries[0].Impressions != 5000 {
		t.Errorf("impressions=%d, want 5000", summaries[0].Impressions)
	}
}

func TestMetricsRepository_UpsertMonthly_UpdatesOnConflict(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewMetricsRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-metrics-moup", "Metrics Monthly Update Tenant")

	m := MonthlySummary{
		ID:           "ms-upd",
		TenantID:     "t-metrics-moup",
		Month:        "2025-02",
		CampaignID:   "camp-moup",
		CampaignName: "Camp",
		Impressions:  1000,
	}
	if err := repo.UpsertMonthly(ctx, m); err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Same (tenant_id, month, campaign_id) → update
	m.Impressions = 2000
	if err := repo.UpsertMonthly(ctx, m); err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	summaries, err := repo.GetMonthlySummary(ctx, "t-metrics-moup", 10)
	if err != nil {
		t.Fatalf("get summary: %v", err)
	}
	if len(summaries) != 1 {
		t.Fatalf("len=%d, want 1 (upsert must not duplicate)", len(summaries))
	}
	if summaries[0].Impressions != 2000 {
		t.Errorf("impressions=%d, want 2000 after update", summaries[0].Impressions)
	}
}

func TestMetricsRepository_GetMonthlySummary_RespectsLimit(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewMetricsRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-metrics-lim", "Metrics Limit Tenant")

	for i := 1; i <= 5; i++ {
		m := MonthlySummary{
			ID:           fmt.Sprintf("ms-lim-%d", i),
			TenantID:     "t-metrics-lim",
			Month:        fmt.Sprintf("2025-%02d", i),
			CampaignID:   "camp-lim",
			CampaignName: "Camp",
		}
		if err := repo.UpsertMonthly(ctx, m); err != nil {
			t.Fatalf("upsert %d: %v", i, err)
		}
	}

	summaries, err := repo.GetMonthlySummary(ctx, "t-metrics-lim", 3)
	if err != nil {
		t.Fatalf("get with limit=3: %v", err)
	}
	if len(summaries) != 3 {
		t.Errorf("len=%d, want 3 (limit=3)", len(summaries))
	}
}
