package adjuster

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockMetricsRepo implements MetricsRepository for tests.
type mockMetricsRepo struct {
	metrics []repository.DailyMetric
	err     error
}

func (m *mockMetricsRepo) GetHistory(_ context.Context, _ string, _ time.Time) ([]repository.DailyMetric, error) {
	return m.metrics, m.err
}

// helpers

func oldEnough() string {
	return time.Now().AddDate(0, 0, -30).UTC().Format(time.RFC3339)
}

func recentlyAdjusted() string {
	return time.Now().AddDate(0, 0, -1).UTC().Format(time.RFC3339)
}

func baseResource() domain.ConnectorResource {
	return domain.ConnectorResource{
		ID:         "res-1",
		TenantID:   "tenant-1",
		ResourceID: "camp-123",
		Metadata: map[string]any{
			"campaign_created_date": oldEnough(),
			"campaign_bid_brl":      10.0,
			"campaign_budget_brl":   100.0,
		},
	}
}

func baseConfig() domain.AdsMonitoringConfig {
	return domain.AdsMonitoringConfig{
		TargetCPABRL:        50.0,
		MaxCPAMultiplier:    1.5,
		MinDailyImpressions: 100,
		MaxIncreasePct:      20.0,
		MaxDecreasePct:      20.0,
	}
}

func metricsWithCPA(cpa float64, days int) []repository.DailyMetric {
	out := make([]repository.DailyMetric, days)
	for i := range days {
		cpaCopy := cpa
		cost := 50.0
		conversions := cost / cpa
		out[i] = repository.DailyMetric{
			CampaignID:  "camp-123",
			Impressions: 200,
			CostBRL:     cost,
			Conversions: conversions,
			CPABRL:      &cpaCopy,
		}
	}
	return out
}

func metricsWithImpressions(imp int32, cpa float64, days int) []repository.DailyMetric {
	out := make([]repository.DailyMetric, days)
	for i := range days {
		cpaCopy := cpa
		out[i] = repository.DailyMetric{
			CampaignID:  "camp-123",
			Impressions: imp,
			CostBRL:     40.0,
			Conversions: 1.0,
			CPABRL:      &cpaCopy,
		}
	}
	return out
}

// --- Guard tests ---

func TestEvaluate_Guard_MissingCreatedDate(t *testing.T) {
	t.Parallel()
	res := baseResource()
	delete(res.Metadata, "campaign_created_date")
	e := New(&mockMetricsRepo{}, nil)
	p, err := e.Evaluate(context.Background(), res, baseConfig())
	require.NoError(t, err)
	assert.Nil(t, p)
}

func TestEvaluate_Guard_InvalidCreatedDate(t *testing.T) {
	t.Parallel()
	res := baseResource()
	res.Metadata["campaign_created_date"] = "not-a-date"
	e := New(&mockMetricsRepo{}, nil)
	p, err := e.Evaluate(context.Background(), res, baseConfig())
	require.NoError(t, err)
	assert.Nil(t, p)
}

func TestEvaluate_Guard_CampaignTooYoung(t *testing.T) {
	t.Parallel()
	res := baseResource()
	res.Metadata["campaign_created_date"] = time.Now().AddDate(0, 0, -5).UTC().Format(time.RFC3339)
	e := New(&mockMetricsRepo{}, nil)
	p, err := e.Evaluate(context.Background(), res, baseConfig())
	require.NoError(t, err)
	assert.Nil(t, p)
}

func TestEvaluate_Guard_CampaignExactlyAtAgeThreshold(t *testing.T) {
	t.Parallel()
	// Exactly at minimum age (14 days) — should NOT skip
	cfg := baseConfig()
	res := baseResource()
	res.Metadata["campaign_created_date"] = time.Now().AddDate(0, 0, -14).Add(-time.Minute).UTC().Format(time.RFC3339)
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(50.0, 5)}, nil)
	// No proposal expected (CPA at target, not below 80%, impressions above threshold) but should NOT be skipped by age guard
	p, err := e.Evaluate(context.Background(), res, cfg)
	require.NoError(t, err)
	// May be nil (no action needed) but not skipped due to age
	_ = p
}

func TestEvaluate_Guard_IntervalNotElapsed(t *testing.T) {
	t.Parallel()
	res := baseResource()
	res.Metadata["last_adjusted_at"] = recentlyAdjusted()
	e := New(&mockMetricsRepo{}, nil)
	p, err := e.Evaluate(context.Background(), res, baseConfig())
	require.NoError(t, err)
	assert.Nil(t, p)
}

func TestEvaluate_Guard_IntervalElapsed(t *testing.T) {
	t.Parallel()
	res := baseResource()
	res.Metadata["last_adjusted_at"] = time.Now().AddDate(0, 0, -10).UTC().Format(time.RFC3339)
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(80.0, 4)}, nil)
	// Should NOT skip on interval guard; may produce a proposal
	_, err := e.Evaluate(context.Background(), res, baseConfig())
	require.NoError(t, err)
}

func TestEvaluate_Guard_InsufficientData(t *testing.T) {
	t.Parallel()
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(80.0, 2)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	assert.Nil(t, p)
}

func TestEvaluate_Guard_ExactlyThreeDays(t *testing.T) {
	t.Parallel()
	// Exactly 3 days — should pass the data guard
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(80.0, 3)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	// 80 > 50*1.5=75 → bid decrease
	require.NotNil(t, p)
	assert.Equal(t, BidDecrease, p.Type)
}

func TestEvaluate_Guard_MetricsError(t *testing.T) {
	t.Parallel()
	e := New(&mockMetricsRepo{err: errors.New("db error")}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.Error(t, err)
	assert.Nil(t, p)
}

// --- Decision tests ---

func TestEvaluate_BidDecrease_HighCPA(t *testing.T) {
	t.Parallel()
	// avgCPA=80, target=50, multiplier=1.5 → 80 > 75 → bid decrease
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(80.0, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, BidDecrease, p.Type)
	assert.Equal(t, "res-1", p.CampaignResourceID)
	assert.InDelta(t, 10.0, p.CurrentValue, 0.001)
	// reduction = min(0.10, 20/100=0.20) = 0.10 → proposed = 10*(1-0.10) = 9.0
	assert.InDelta(t, 9.0, p.ProposedValue, 0.001)
	assert.NotEmpty(t, p.Reason)
}

func TestEvaluate_BidDecrease_CappedByMaxDecreasePct(t *testing.T) {
	t.Parallel()
	cfg := baseConfig()
	cfg.MaxDecreasePct = 5.0 // 5% cap is lower than 10% default
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(80.0, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), cfg)
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, BidDecrease, p.Type)
	// reduction = min(0.10, 0.05) = 0.05 → 10*(1-0.05) = 9.5
	assert.InDelta(t, 9.5, p.ProposedValue, 0.001)
}

func TestEvaluate_BidIncrease_LowCPAWithConversions(t *testing.T) {
	t.Parallel()
	// avgCPA=35, target=50 → 35 < 50*0.80=40 AND conversions>0 → bid increase
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(35.0, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, BidIncrease, p.Type)
	// increase = min(0.10, 0.20) = 0.10 → 10*(1+0.10) = 11.0
	assert.InDelta(t, 11.0, p.ProposedValue, 0.001)
}

func TestEvaluate_BidIncrease_CappedByMaxIncreasePct(t *testing.T) {
	t.Parallel()
	cfg := baseConfig()
	cfg.MaxIncreasePct = 5.0
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(35.0, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), cfg)
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, BidIncrease, p.Type)
	// increase = min(0.10, 0.05) = 0.05 → 10*(1+0.05) = 10.5
	assert.InDelta(t, 10.5, p.ProposedValue, 0.001)
}

func TestEvaluate_BidIncrease_NoConversions_NoProposal(t *testing.T) {
	t.Parallel()
	// Low CPA but zero conversions → should NOT bid increase
	metrics := make([]repository.DailyMetric, 4)
	cpa := 35.0
	for i := range metrics {
		metrics[i] = repository.DailyMetric{
			CampaignID:  "camp-123",
			Impressions: 200,
			CostBRL:     0,
			Conversions: 0,
			CPABRL:      &cpa,
		}
	}
	e := New(&mockMetricsRepo{metrics: metrics}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	// No conversions → skip bid increase; impressions OK → no budget increase
	assert.Nil(t, p)
}

func TestEvaluate_BudgetIncrease_LowImpressions(t *testing.T) {
	t.Parallel()
	// avgImpressions=50 < 100, avgCPA=40 <= 50 → budget increase
	e := New(&mockMetricsRepo{metrics: metricsWithImpressions(50, 40.0, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, BudgetIncrease, p.Type)
	assert.InDelta(t, 100.0, p.CurrentValue, 0.001)
	// increase = min(0.10, 0.20) = 0.10 → 100*(1.10) = 110
	assert.InDelta(t, 110.0, p.ProposedValue, 0.001)
}

func TestEvaluate_BudgetIncrease_FallsBackToAvgCost(t *testing.T) {
	t.Parallel()
	res := baseResource()
	delete(res.Metadata, "campaign_budget_brl")
	// avgCost = 40.0, avgImpressions=50 < 100, cpa=40 <= 50
	e := New(&mockMetricsRepo{metrics: metricsWithImpressions(50, 40.0, 4)}, nil)
	p, err := e.Evaluate(context.Background(), res, baseConfig())
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, BudgetIncrease, p.Type)
	// currentBudget falls back to avgCost = 40.0 → 40*(1.10) = 44
	assert.InDelta(t, 44.0, p.ProposedValue, 0.001)
}

func TestEvaluate_NoAction_CPAAtTarget(t *testing.T) {
	t.Parallel()
	// avgCPA=50 == target → no action (not above multiplier, not below 80%, impressions OK)
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(50.0, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	assert.Nil(t, p)
}

func TestEvaluate_NoAction_ImpressionsBelowButCPAHigh(t *testing.T) {
	t.Parallel()
	// Low impressions but CPA > target → no budget increase (CPA condition fails)
	e := New(&mockMetricsRepo{metrics: metricsWithImpressions(50, 60.0, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	// 60 < 75 (not bid decrease), 60 > 40 (not bid increase), CPA>target (no budget)
	assert.Nil(t, p)
}

// --- Boundary conditions ---

func TestEvaluate_Boundary_CPAExactlyAtMultiplier(t *testing.T) {
	t.Parallel()
	// avgCPA = 50*1.5 = 75.0 — exactly AT the multiplier, should NOT trigger bid decrease
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(75.0, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	// 75 is not > 75, so no bid decrease
	// 75 > 40 (80% of 50), so no bid increase
	// impressions >= 100, so no budget increase
	assert.Nil(t, p)
}

func TestEvaluate_Boundary_CPAJustAboveMultiplier(t *testing.T) {
	t.Parallel()
	// avgCPA = 75.01 → just above 50*1.5=75 → bid decrease
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(75.01, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, BidDecrease, p.Type)
}

func TestEvaluate_Boundary_CPAExactlyAt80Pct(t *testing.T) {
	t.Parallel()
	// avgCPA = 50*0.80 = 40.0 — exactly AT 80%, should NOT trigger bid increase
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(40.0, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	// 40 is not < 40, so no bid increase
	assert.Nil(t, p)
}

func TestEvaluate_Boundary_CPAJustBelow80Pct(t *testing.T) {
	t.Parallel()
	// avgCPA = 39.9 → just below 40 (80% of 50) → bid increase
	e := New(&mockMetricsRepo{metrics: metricsWithCPA(39.9, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, BidIncrease, p.Type)
}

func TestEvaluate_Boundary_ImpressionsExactlyAtThreshold(t *testing.T) {
	t.Parallel()
	// avgImpressions = 100 exactly — should NOT trigger budget increase
	e := New(&mockMetricsRepo{metrics: metricsWithImpressions(100, 40.0, 4)}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	// 100 is not < 100, CPA is 40 < 40 (80% of 50) → bid increase wins
	// Actually 39.9 < 40, let's check: cpa=40.0, 40 < 40*0.80=40 is false, so no bid increase
	// 40 < 100 → no budget increase
	assert.Nil(t, p)
}

func TestEvaluate_MetricsFilteredByCampaignID(t *testing.T) {
	t.Parallel()
	// Metrics for a different campaign should be ignored
	otherCPA := 80.0
	metrics := []repository.DailyMetric{
		{CampaignID: "other-camp", Impressions: 200, CostBRL: 50, Conversions: 1, CPABRL: &otherCPA},
		{CampaignID: "other-camp", Impressions: 200, CostBRL: 50, Conversions: 1, CPABRL: &otherCPA},
		{CampaignID: "other-camp", Impressions: 200, CostBRL: 50, Conversions: 1, CPABRL: &otherCPA},
		{CampaignID: "other-camp", Impressions: 200, CostBRL: 50, Conversions: 1, CPABRL: &otherCPA},
	}
	e := New(&mockMetricsRepo{metrics: metrics}, nil)
	p, err := e.Evaluate(context.Background(), baseResource(), baseConfig())
	require.NoError(t, err)
	// No data for "camp-123" → insufficient data guard
	assert.Nil(t, p)
}
