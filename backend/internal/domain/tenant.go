package domain

import (
	"encoding/json"
	"fmt"
	"time"
)

const (
	DefaultMinCampaignAgeDays     = 14
	DefaultAdjustmentIntervalDays = 7
)

type ReportPrompts struct {
	Instant string `json:"instant,omitempty"`
	Daily   string `json:"daily,omitempty"`
	Weekly  string `json:"weekly,omitempty"`
	Monthly string `json:"monthly,omitempty"`
}

type AdsMonitoringConfig struct {
	// thresholds (existing)
	TargetCPABRL             float64 `json:"target_cpa_brl"`
	NoConversionAlertDays    int     `json:"no_conversion_alert_days"`
	MaxCPAMultiplier         float64 `json:"max_cpa_multiplier"`
	MinDailyImpressions      int     `json:"min_daily_impressions"`
	BudgetUnderpaceThreshold float64 `json:"budget_underpace_threshold"`

	// automation
	SyncEnabled     bool `json:"sync_enabled"`
	AIReportDaily   bool `json:"ai_report_daily"`
	AIReportWeekly  bool `json:"ai_report_weekly"`
	AIReportMonthly bool `json:"ai_report_monthly"`

	// adjustments
	AdjustmentsEnabled    bool    `json:"adjustments_enabled"`
	MaxIncreasePct        float64 `json:"max_increase_pct"`
	MaxIncreaseBRL        float64 `json:"max_increase_brl"`
	MaxDecreasePct        float64 `json:"max_decrease_pct"`
	MaxDecreaseBRL        float64 `json:"max_decrease_brl"`
	SuggestionsEnabled    bool    `json:"suggestions_enabled"`
	MinCampaignAgeDays    int     `json:"min_campaign_age_days"`
	AdjustmentIntervalDays int    `json:"adjustment_interval_days"`
}

// EffectiveMinCampaignAgeDays returns the configured value or the default when zero.
func (c *AdsMonitoringConfig) EffectiveMinCampaignAgeDays() int {
	if c.MinCampaignAgeDays == 0 {
		return DefaultMinCampaignAgeDays
	}
	return c.MinCampaignAgeDays
}

// EffectiveAdjustmentIntervalDays returns the configured value or the default when zero.
func (c *AdsMonitoringConfig) EffectiveAdjustmentIntervalDays() int {
	if c.AdjustmentIntervalDays == 0 {
		return DefaultAdjustmentIntervalDays
	}
	return c.AdjustmentIntervalDays
}

// Validate checks that optional guard fields are within allowed ranges when provided.
func (c *AdsMonitoringConfig) Validate() error {
	if c.MinCampaignAgeDays != 0 && (c.MinCampaignAgeDays < 7 || c.MinCampaignAgeDays > 90) {
		return fmt.Errorf("min_campaign_age_days must be between 7 and 90")
	}
	if c.AdjustmentIntervalDays != 0 && (c.AdjustmentIntervalDays < 3 || c.AdjustmentIntervalDays > 30) {
		return fmt.Errorf("adjustment_interval_days must be between 3 and 30")
	}
	return nil
}

type Tenant struct {
	ID             string
	Name           string
	Language       string
	Niche          *string
	Location       *string
	PrimaryPersona *string
	Tone           *string
	Instructions   *string
	Hashtags       []string
	AdsMonitoring  *AdsMonitoringConfig
	ReportPrompts  *ReportPrompts
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

func (t *Tenant) HashtagsJSON() ([]byte, error)      { return json.Marshal(t.Hashtags) }
func (t *Tenant) AdsMonitoringJSON() ([]byte, error) { return json.Marshal(t.AdsMonitoring) }
