package domain

import (
	"encoding/json"
	"time"
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

	// adjustments (UI-only for now — backend logic not wired)
	AdjustmentsEnabled bool    `json:"adjustments_enabled"`
	MaxIncreasePct     float64 `json:"max_increase_pct"`
	MaxIncreaseBRL     float64 `json:"max_increase_brl"`
	MaxDecreasePct     float64 `json:"max_decrease_pct"`
	MaxDecreaseBRL     float64 `json:"max_decrease_brl"`
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
