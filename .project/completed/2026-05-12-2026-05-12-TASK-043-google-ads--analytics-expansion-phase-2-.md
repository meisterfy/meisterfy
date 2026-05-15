---
title: "Google Ads — Analytics Expansion Phase 2 (Backend Segmentation)"
created: 2026-05-12T02:34:14.621Z
priority: P1-L
status: backlog
tags: [feat]
---

# Google Ads — Analytics Expansion Phase 2 (Backend Segmentation)

## Goal
Add device breakdown, hourly performance heatmap, and Lost Impression Share to the campaign detail page. Requires new GAQL queries in Go, new API endpoints, and new frontend components.

**Prerequisite:** TASK-042 (Phase 1) must be complete.

---

## Project Context
- **Backend:** Go, chi router, `pgx/v5`, `backend/internal/connector/googleads/`, `backend/internal/api/`
- **Frontend:** SvelteKit 5 (Svelte runes), TypeScript, Tailwind v4, Chart.js
- **Conventions:** kebab-case filenames (frontend), standard Go conventions (backend)
- **Error handling:** follow `golang-error-handling` skill patterns (wrap with `%w`, return typed errors)
- **Context propagation:** all backend functions accept `context.Context` as first arg

## Existing Backend Architecture (read these files before starting)
- `backend/internal/connector/googleads/client.go` — `Client` struct with `Query(ctx, gaql) ([]map[string]map[string]any, error)`
- `backend/internal/connector/googleads/detail.go` — pattern for GAQL queries, `num()`, `str()`, `fromMicros()` helpers
- `backend/internal/connector/googleads/segments.go` — **check if this file exists**; if it does, read it and build on it rather than replacing it
- `backend/internal/api/admin_google_ads.go` — **read this file first** (untracked in git, may already have some endpoints); add to it, do not replace it

## GAQL Reference
- `segments.device` → values: `"DESKTOP"`, `"MOBILE"`, `"TABLET"`, `"CONNECTED_TV"`, `"OTHER"`
- `segments.hour` → integer 0–23
- `metrics.search_impression_share` → float 0.0–1.0
- `metrics.search_budget_lost_impression_share` → float 0.0–1.0
- `metrics.search_rank_lost_impression_share` → float 0.0–1.0
- `metrics.cost_micros` → divide by 1,000,000 for BRL (use existing `fromMicros()` helper)

---

## Deliverables

### 1. Backend — `segments.go` (create or extend)

Add three new connector methods to `backend/internal/connector/googleads/segments.go`:

#### 1a. `GetDeviceBreakdown`

```go
type DeviceRow struct {
    Device      string  `json:"device"`
    Cost        float64 `json:"cost"`        // BRL
    Conversions float64 `json:"conversions"`
    Clicks      float64 `json:"clicks"`
    Impressions float64 `json:"impressions"`
    CPA         float64 `json:"cpa"`         // 0 if no conversions
    CTR         float64 `json:"ctr"`         // 0–100 percentage
}

func (c *Client) GetDeviceBreakdown(ctx context.Context, campaignID, startDate, endDate string) ([]DeviceRow, error)
```

GAQL:
```sql
SELECT segments.device,
       metrics.cost_micros, metrics.conversions, metrics.clicks, metrics.impressions
FROM campaign
WHERE campaign.id = {campaignID}
  AND segments.date BETWEEN '{startDate}' AND '{endDate}'
ORDER BY segments.device
```

Aggregate by device in Go (multiple date rows per device), compute CPA and CTR. Include only DESKTOP, MOBILE, TABLET — filter out CONNECTED_TV and OTHER if their impressions are 0. Return empty slice (not nil) if no data.

#### 1b. `GetHourlyBreakdown`

```go
type HourlyRow struct {
    Hour        int     `json:"hour"`         // 0–23
    Cost        float64 `json:"cost"`          // BRL
    Conversions float64 `json:"conversions"`
    Clicks      float64 `json:"clicks"`
    Impressions float64 `json:"impressions"`
}

func (c *Client) GetHourlyBreakdown(ctx context.Context, campaignID, startDate, endDate string) ([]HourlyRow, error)
```

GAQL:
```sql
SELECT segments.hour,
       metrics.cost_micros, metrics.conversions, metrics.clicks, metrics.impressions
FROM campaign
WHERE campaign.id = {campaignID}
  AND segments.date BETWEEN '{startDate}' AND '{endDate}'
ORDER BY segments.hour
```

Aggregate all days into a single 24-slot array. Fill missing hours with zero-value `HourlyRow`. Always return exactly 24 rows (indices 0–23).

#### 1c. `GetImpressionShare`

```go
type ImpressionShareStats struct {
    WonShare   float64 `json:"wonShare"`   // 0.0–1.0, avg search_impression_share
    LostBudget float64 `json:"lostBudget"` // 0.0–1.0, avg search_budget_lost_impression_share
    LostRank   float64 `json:"lostRank"`   // 0.0–1.0, avg search_rank_lost_impression_share
}

func (c *Client) GetImpressionShare(ctx context.Context, campaignID, startDate, endDate string) (*ImpressionShareStats, error)
```

GAQL:
```sql
SELECT metrics.search_impression_share,
       metrics.search_budget_lost_impression_share,
       metrics.search_rank_lost_impression_share
FROM campaign
WHERE campaign.id = {campaignID}
  AND segments.date BETWEEN '{startDate}' AND '{endDate}'
```

Average across all rows (exclude rows where all three fields are 0). Return `nil` if no valid rows.

---

### 2. Backend — New API Endpoints (in `admin_google_ads.go`)

Read the existing file first. Add these three endpoints using the same handler pattern already present:

#### `GET /admin/tenants/{tenant}/campaigns/live/{id}/devices`
Query params: `startDate`, `endDate` (both optional; if absent, default to last 30 days in the handler)
- Get Google Ads client for tenant
- Call `GetDeviceBreakdown(ctx, campaignID, startDate, endDate)`
- Return JSON array

#### `GET /admin/tenants/{tenant}/campaigns/live/{id}/hourly`
Query params: `startDate`, `endDate` (optional; default last 30 days)
- Call `GetHourlyBreakdown`
- Return JSON array of 24 rows

#### `GET /admin/tenants/{tenant}/campaigns/live/{id}/impression-share`
Query params: `startDate`, `endDate` (optional; default last 30 days)
- Call `GetImpressionShare`
- Return JSON object or `null`

Register all three routes in the same router group where existing campaign live routes are registered. Check the router setup file to find the correct registration point.

---

### 3. Frontend — API Client (`$lib/api/campaigns.ts`)

Add new TypeScript interfaces and fetch functions following the existing patterns (`apiFetchData`, `withFallback`):

```ts
export interface DeviceRow {
  device: string
  cost: number
  conversions: number
  clicks: number
  impressions: number
  cpa: number
  ctr: number
}

export interface HourlyRow {
  hour: number
  cost: number
  conversions: number
  clicks: number
  impressions: number
}

export interface ImpressionShareStats {
  wonShare: number    // 0.0–1.0
  lostBudget: number  // 0.0–1.0
  lostRank: number    // 0.0–1.0
}

export const getDeviceBreakdown = (tenantId, campaignId, params, fetchFn?) => ...
export const getHourlyBreakdown  = (tenantId, campaignId, params, fetchFn?) => ...
export const getImpressionShare  = (tenantId, campaignId, params, fetchFn?) => ...
```

In `+page.ts`, add to the `streamed` object:
```ts
devices:          withFallback(getDeviceBreakdown(params.tenant, params.campaign_id, { startDate, endDate }, fetch), []),
hourly:           withFallback(getHourlyBreakdown(params.tenant, params.campaign_id, { startDate, endDate }, fetch), []),
impressionShare:  withFallback(getImpressionShare(params.tenant, params.campaign_id, { startDate, endDate }, fetch), null),
```

Update the `PageData` type accordingly (SvelteKit infers it from `+page.ts` return type automatically).

In `+page.svelte`, pass the new streams to `<LiveTab>`. Update `LiveTab` props to accept them.

---

### 4. Frontend — New Components (Live Tab)

#### `components/device-breakdown.svelte`
**Props:** `{ devices: DeviceRow[] }`

If `devices` is empty, show a "No device data available" placeholder.

Render two visualizations:
- **Donut chart** (Chart.js): cost share by device (DESKTOP/MOBILE/TABLET), colored blue/green/amber
- **Horizontal bar comparison**: CPA per device (if conversions > 0), sorted ascending

Wrap in card titled **"Performance by Device"**. Add note "Use to inform device bid adjustments".

#### `components/hourly-heatmap.svelte`
**Props:** `{ hourly: HourlyRow[] }`

If all hours have 0 conversions, show "No conversion data for this period".

Render a Chart.js bar chart:
- X-axis: hours "0h" to "23h"
- Primary bars (left y-axis): conversions per hour
- Secondary line (right y-axis): cost per hour
- Highlight top 3 hours by conversions with a different bar color (emerald)

Card title: **"Hourly Performance Distribution"**. Subtext: "Top hours highlighted in green".

#### `components/impression-share-card.svelte`
**Props:** `{ stats: ImpressionShareStats | null }`

If `stats` is null, render nothing.

Render a stacked horizontal bar (plain Tailwind divs, no Chart.js needed):
- Green segment: `wonShare * 100%` — "Won"
- Amber segment: `lostBudget * 100%` — "Lost to Budget"
- Red segment: `lostRank * 100%` — "Lost to Rank"

Below the bar, show three labeled percentages.

Show contextual warnings:
- If `lostBudget > 0.15`: amber banner "Budget is limiting reach — consider increasing daily budget"
- If `lostRank > 0.15`: red banner "Rank is limiting reach — consider improving Quality Score or bids"

Card title: **"Search Impression Share"**.

---

### 5. Integration in `tabs/live.svelte`

Update props:
```ts
let { detail, isLoadingPeriod, onSetPeriod, onClearPeriod, devices, hourly, impressionShare } = $props<{
  detail: Promise<LiveCampaignDetail | null>
  isLoadingPeriod: boolean
  onSetPeriod: (days: number) => void
  onClearPeriod: () => void
  devices: Promise<DeviceRow[]>
  hourly: Promise<HourlyRow[]>
  impressionShare: Promise<ImpressionShareStats | null>
}>()
```

Add at the bottom of the `{#if d}` block (after existing content):
```svelte
{#await impressionShare then is}
  <ImpressionShareCard stats={is} />
{/await}

{#await devices then devs}
  <DeviceBreakdown devices={devs} />
{/await}

{#await hourly then hrs}
  <HourlyHeatmap hourly={hrs} />
{/await}
```

Each `{#await}` should have a skeleton while loading (simple `animate-pulse` rounded div).

---

## i18n
Add any new string keys to both `locales/en/ads.json` and `locales/pt-BR/ads.json`.

## Definition of Done
- [ ] `segments.go` created/extended with 3 connector functions
- [ ] 3 new endpoints registered and reachable
- [ ] New types and fetch functions added to `campaigns.ts`
- [ ] `+page.ts` streams 3 new data sources; `+page.svelte` passes them to `<LiveTab>`
- [ ] 3 new frontend components integrated in `tabs/live.svelte`
- [ ] Edge cases handled: empty arrays, null stats, 0 conversions, missing hours
- [ ] `go build ./...` and `bun run build` pass cleanly


