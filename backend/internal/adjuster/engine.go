package adjuster

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/mkt-maestro/mkt-maestro/internal/domain"
	"github.com/mkt-maestro/mkt-maestro/internal/repository"
)

type AdjustmentType string

const (
	BidIncrease    AdjustmentType = "bid_increase"
	BidDecrease    AdjustmentType = "bid_decrease"
	BudgetIncrease AdjustmentType = "budget_increase"
	BudgetDecrease AdjustmentType = "budget_decrease"
)

type Proposal struct {
	CampaignResourceID string
	Type               AdjustmentType
	CurrentValue       float64
	ProposedValue      float64
	Reason             string
}

// MetricsRepository is the read-only metrics interface the engine needs.
type MetricsRepository interface {
	GetHistory(ctx context.Context, tenantID string, since time.Time) ([]repository.DailyMetric, error)
}

// ConnectorResourceRepository is reserved for future use (e.g. writing back metadata after adjustment).
type ConnectorResourceRepository interface{}

type Engine struct {
	metrics   MetricsRepository
	resources ConnectorResourceRepository
}

func New(metrics MetricsRepository, resources ConnectorResourceRepository) *Engine {
	return &Engine{metrics: metrics, resources: resources}
}

// Evaluate returns nil, nil when the campaign should be skipped (guard triggered).
// Returns an error only on infrastructure failure.
func (e *Engine) Evaluate(ctx context.Context, resource domain.ConnectorResource, config domain.AdsMonitoringConfig) (*Proposal, error) {
	// Guard 1: campaign age
	createdDateStr, _ := resource.Metadata["campaign_created_date"].(string)
	if createdDateStr == "" {
		slog.DebugContext(ctx, "adjuster: skipping — campaign_created_date missing", "resource_id", resource.ID)
		return nil, nil
	}
	createdDate, err := time.Parse(time.RFC3339, createdDateStr)
	if err != nil {
		slog.DebugContext(ctx, "adjuster: skipping — campaign_created_date parse error", "resource_id", resource.ID, "err", err)
		return nil, nil
	}
	minAge := time.Duration(config.EffectiveMinCampaignAgeDays()) * 24 * time.Hour
	if time.Since(createdDate) < minAge {
		slog.DebugContext(ctx, "adjuster: skipping — campaign too young", "resource_id", resource.ID)
		return nil, nil
	}

	// Guard 2: interval since last adjustment
	if lastStr, _ := resource.Metadata["last_adjusted_at"].(string); lastStr != "" {
		if lastAdjusted, err := time.Parse(time.RFC3339, lastStr); err == nil {
			interval := time.Duration(config.EffectiveAdjustmentIntervalDays()) * 24 * time.Hour
			if time.Since(lastAdjusted) < interval {
				slog.DebugContext(ctx, "adjuster: skipping — adjustment interval not elapsed", "resource_id", resource.ID)
				return nil, nil
			}
		}
	}

	// Guard 3: minimum data (3+ days with data in the last 7 days)
	since := time.Now().AddDate(0, 0, -7)
	allMetrics, err := e.metrics.GetHistory(ctx, resource.TenantID, since)
	if err != nil {
		return nil, fmt.Errorf("adjuster: fetch metrics: %w", err)
	}
	var metrics []repository.DailyMetric
	for _, m := range allMetrics {
		if m.CampaignID == resource.ResourceID {
			metrics = append(metrics, m)
		}
	}
	if len(metrics) < 3 {
		slog.DebugContext(ctx, "adjuster: skipping — insufficient data", "resource_id", resource.ID, "days", len(metrics))
		return nil, nil
	}

	// Compute 7-day averages
	var totalImpressions, totalCost, totalConversions float64
	var totalCPA float64
	var cpaCount int
	for _, m := range metrics {
		totalImpressions += float64(m.Impressions)
		totalCost += m.CostBRL
		totalConversions += m.Conversions
		if m.CPABRL != nil {
			totalCPA += *m.CPABRL
			cpaCount++
		}
	}
	n := float64(len(metrics))
	avgImpressions := totalImpressions / n
	avgCost := totalCost / n

	var avgCPA float64
	if cpaCount > 0 {
		avgCPA = totalCPA / float64(cpaCount)
	} else if totalConversions > 0 {
		avgCPA = totalCost / totalConversions
	}

	// Read current bid/budget from resource metadata; fall back to avg cost for budget
	currentBid := metadataFloat(resource.Metadata, "campaign_bid_brl")
	currentBudget := metadataFloat(resource.Metadata, "campaign_budget_brl")
	if currentBudget == 0 {
		currentBudget = avgCost
	}

	// Decision logic
	if avgCPA > config.TargetCPABRL*config.MaxCPAMultiplier {
		reduction := min(0.10, config.MaxDecreasePct/100)
		return &Proposal{
			CampaignResourceID: resource.ID,
			Type:               BidDecrease,
			CurrentValue:       currentBid,
			ProposedValue:      currentBid * (1 - reduction),
			Reason:             fmt.Sprintf("CPA R$%.2f — %.0f%% above target for 7 days", avgCPA, (avgCPA/config.TargetCPABRL-1)*100),
		}, nil
	}

	if avgCPA < config.TargetCPABRL*0.80 && totalConversions > 0 {
		increase := min(0.10, config.MaxIncreasePct/100)
		return &Proposal{
			CampaignResourceID: resource.ID,
			Type:               BidIncrease,
			CurrentValue:       currentBid,
			ProposedValue:      currentBid * (1 + increase),
			Reason:             fmt.Sprintf("CPA R$%.2f — 20%%+ below target with active conversions", avgCPA),
		}, nil
	}

	if avgImpressions < float64(config.MinDailyImpressions) && avgCPA <= config.TargetCPABRL {
		increase := min(0.10, config.MaxIncreasePct/100)
		return &Proposal{
			CampaignResourceID: resource.ID,
			Type:               BudgetIncrease,
			CurrentValue:       currentBudget,
			ProposedValue:      currentBudget * (1 + increase),
			Reason:             fmt.Sprintf("%.0f avg daily impressions below threshold (%d) with acceptable CPA", avgImpressions, config.MinDailyImpressions),
		}, nil
	}

	return nil, nil
}

func metadataFloat(m map[string]any, key string) float64 {
	if m == nil {
		return 0
	}
	switch v := m[key].(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	}
	return 0
}
