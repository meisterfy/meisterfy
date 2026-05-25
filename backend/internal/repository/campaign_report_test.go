//go:build integration

package repository

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/meisterfy/meisterfy/testutil"
)

func TestCampaignReportRepository_SaveAndList(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewCampaignReportRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rpt", "Report Tenant")

	saved, err := repo.Save(ctx, SaveReportParams{
		TenantID:   "t-rpt",
		CampaignID: "camp-rpt-1",
		ReportType: "weekly",
		Content:    "report content",
	})
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if saved.ID == "" {
		t.Error("saved ID should not be empty")
	}
	if saved.TenantID != "t-rpt" {
		t.Errorf("tenantID=%q, want t-rpt", saved.TenantID)
	}
	if saved.Content != "report content" {
		t.Errorf("content=%q, want 'report content'", saved.Content)
	}

	reports, err := repo.List(ctx, "t-rpt", "camp-rpt-1", "weekly", 10)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(reports) != 1 {
		t.Errorf("len=%d, want 1", len(reports))
	}
}

func TestCampaignReportRepository_Save_WithPeriodAndModel(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewCampaignReportRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rpt-period", "Report Period Tenant")

	start := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2025, 1, 31, 0, 0, 0, 0, time.UTC)
	model := "claude-sonnet-4"

	saved, err := repo.Save(ctx, SaveReportParams{
		TenantID:    "t-rpt-period",
		CampaignID:  "camp-period",
		ReportType:  "monthly",
		Content:     "monthly content",
		PeriodStart: &start,
		PeriodEnd:   &end,
		Model:       &model,
	})
	if err != nil {
		t.Fatalf("save with period: %v", err)
	}
	if saved.PeriodStart == nil {
		t.Error("period_start should not be nil")
	}
	if saved.PeriodEnd == nil {
		t.Error("period_end should not be nil")
	}
	if saved.Model == nil || *saved.Model != "claude-sonnet-4" {
		t.Errorf("model=%v, want claude-sonnet-4", saved.Model)
	}
}

func TestCampaignReportRepository_List_Multiple(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewCampaignReportRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rpt-multi", "Report Multi Tenant")

	for i := 0; i < 3; i++ {
		if _, err := repo.Save(ctx, SaveReportParams{
			TenantID:   "t-rpt-multi",
			CampaignID: "camp-multi",
			ReportType: "weekly",
			Content:    fmt.Sprintf("report %d", i),
		}); err != nil {
			t.Fatalf("save %d: %v", i, err)
		}
	}

	reports, err := repo.List(ctx, "t-rpt-multi", "camp-multi", "weekly", 10)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(reports) != 3 {
		t.Errorf("len=%d, want 3", len(reports))
	}
}

func TestCampaignReportRepository_List_RespectsLimit(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewCampaignReportRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rpt-lim", "Report Limit Tenant")

	for i := 0; i < 5; i++ {
		if _, err := repo.Save(ctx, SaveReportParams{
			TenantID:   "t-rpt-lim",
			CampaignID: "camp-lim",
			ReportType: "weekly",
			Content:    fmt.Sprintf("r%d", i),
		}); err != nil {
			t.Fatalf("save %d: %v", i, err)
		}
	}

	reports, err := repo.List(ctx, "t-rpt-lim", "camp-lim", "weekly", 2)
	if err != nil {
		t.Fatalf("list with limit 2: %v", err)
	}
	if len(reports) != 2 {
		t.Errorf("len=%d, want 2 (limit=2)", len(reports))
	}
}

func TestCampaignReportRepository_List_Empty(t *testing.T) {
	sharedDB.ResetDB(t)
	ctx := context.Background()
	repo := NewCampaignReportRepository(sharedDB.Pool)

	testutil.MustCreateTenant(ctx, t, sharedDB.Pool, "t-rpt-empty", "Report Empty Tenant")

	reports, err := repo.List(ctx, "t-rpt-empty", "camp-none", "weekly", 10)
	if err != nil {
		t.Fatalf("list empty: %v", err)
	}
	if len(reports) != 0 {
		t.Errorf("len=%d, want 0", len(reports))
	}
}
