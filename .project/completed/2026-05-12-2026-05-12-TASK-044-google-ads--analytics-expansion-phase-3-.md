---
title: "Google Ads — Analytics Expansion Phase 3 (Search Intelligence)"
created: 2026-05-12T02:35:20.751Z
priority: P2-L
status: backlog
tags: [feat]
---

# Google Ads — Analytics Expansion Phase 3 (Search Intelligence)

## Goal
Add Search Terms report, Quality Score monitoring, and keyword-level analysis to the campaign detail page. These are the most actionable optimization signals available in the Google Ads API.

**Prerequisites:** TASK-042 (Phase 1) and TASK-043 (Phase 2) must be complete.

---

## Project Context
- **Backend:** Go, chi router, `backend/internal/connector/googleads/`, `backend/internal/api/admin_google_ads.go`
- **Frontend:** SvelteKit 5 (Svelte runes), TypeScript, Tailwind v4, Chart.js
- **Conventions:** kebab-case filenames (frontend), standard Go idioms (backend)
- **Read before starting:**
  - `backend/internal/connector/googleads/client.go` — `Client.Query()` method
  - `backend/internal/connector/googleads/detail.go` — `num()`, `str()`, `fromMicros()` helpers
  - `backend/internal/connector/googleads/segments.go` — pattern established in Phase 2
  - `backend/internal/api/admin_google_ads.go` — existing endpoints, add to it

---

## Domain Knowledge (important for correct GAQL)

### Search Terms Report
The `search_term_view` resource shows actual search queries that triggered ads. Key distinction:
- **Converting terms**: `conversions > 0` — should be added as exact match keywords
- **Wasted terms**: `cost > threshold, conversions = 0` — candidates for negative keywords

GAQL uses `search_term_view` (not `campaign`). Available fields:
- `search_term_view.search_term` — the actual query string
- `search_term_view.status` — "ADDED", "EXCLUDED", "NONE" (EXCLUDED = already a negative)
- `metrics.clicks`, `metrics.impressions`, `metrics.cost_micros`, `metrics.conversions`

### Quality Score
Stored at the keyword level in `ad_group_criterion`. Fields:
- `ad_group_criterion.quality_info.quality_score` — integer 1–10 (null if not enough data)
- `ad_group_criterion.quality_info.creative_quality_score` — "BELOW_AVERAGE" / "AVERAGE" / "ABOVE_AVERAGE"
- `ad_group_criterion.quality_info.post_click_quality_score` — same enum
- `ad_group_criterion.quality_info.search_predicted_ctr` — same enum
- `ad_group_criterion.keyword.text` — the keyword text
- `ad_group_criterion.keyword.match_type` — "BROAD" / "PHRASE" / "EXACT"
- `ad_group.name` — which ad group this keyword belongs to

### Keywords Performance
Uses `ad_group_criterion` with metric filtering. Same resource as QS above but with metrics.

---

## Deliverables

### 1. Backend — `search_intelligence.go` (new file)

Create `backend/internal/connector/googleads/search_intelligence.go`.

#### 1a. `GetSearchTerms`

```go
type SearchTermRow struct {
    Term        string  `json:"term"`
    Status      string  `json:"status"`       // "ADDED", "EXCLUDED", "NONE"
    Clicks      float64 `json:"clicks"`
    Impressions float64 `json:"impressions"`
    Cost        float64 `json:"cost"`          // BRL
    Conversions float64 `json:"conversions"`
    CPA         float64 `json:"cpa"`           // 0 if no conversions
    CTR         float64 `json:"ctr"`           // 0–100 percentage
}

func (c *Client) GetSearchTerms(ctx context.Context, campaignID, startDate, endDate string) ([]SearchTermRow, error)
```

GAQL:
```sql
SELECT search_term_view.search_term, search_term_view.status,
       metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions
FROM search_term_view
WHERE campaign.id = {campaignID}
  AND segments.date BETWEEN '{startDate}' AND '{endDate}'
ORDER BY metrics.cost_micros DESC
```

In Go: compute CPA and CTR per row. Sort by cost descending (already in GAQL). Limit to top 100 rows to avoid huge payloads. Return empty slice (not nil) if no data.

**Note:** `search_term_view` does not support `segments.date` in all account types. If the query returns an error containing "search_term_view" and "segments.date", retry without the date filter but still scoped to the campaign.

#### 1b. `GetKeywordQualityScores`

```go
type KeywordQSRow struct {
    KeywordText    string `json:"keywordText"`
    MatchType      string `json:"matchType"`       // "BROAD", "PHRASE", "EXACT"
    AdGroupName    string `json:"adGroupName"`
    QualityScore   int    `json:"qualityScore"`    // 1–10, 0 means "not enough data"
    CreativeQS     string `json:"creativeQS"`      // "BELOW_AVERAGE", "AVERAGE", "ABOVE_AVERAGE", ""
    PostClickQS    string `json:"postClickQS"`     // same enum
    PredictedCTR   string `json:"predictedCTR"`    // same enum
}

func (c *Client) GetKeywordQualityScores(ctx context.Context, campaignID string) ([]KeywordQSRow, error)
```

GAQL (no date filter — QS is not a segmented metric):
```sql
SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
       ad_group_criterion.quality_info.quality_score,
       ad_group_criterion.quality_info.creative_quality_score,
       ad_group_criterion.quality_info.post_click_quality_score,
       ad_group_criterion.quality_info.search_predicted_ctr,
       ad_group.name
FROM ad_group_criterion
WHERE campaign.id = {campaignID}
  AND ad_group_criterion.type = 'KEYWORD'
  AND ad_group_criterion.status != 'REMOVED'
```

`quality_score` may come back as 0 or null from the API if there is insufficient data — keep it as 0 and the frontend will render "N/A". Return empty slice if no keywords.

#### 1c. `GetKeywordPerformance`

```go
type KeywordPerfRow struct {
    KeywordText string  `json:"keywordText"`
    MatchType   string  `json:"matchType"`
    AdGroupName string  `json:"adGroupName"`
    Clicks      float64 `json:"clicks"`
    Impressions float64 `json:"impressions"`
    Cost        float64 `json:"cost"`         // BRL
    Conversions float64 `json:"conversions"`
    CPA         float64 `json:"cpa"`          // 0 if no conversions
    CTR         float64 `json:"ctr"`          // 0–100 percentage
}

func (c *Client) GetKeywordPerformance(ctx context.Context, campaignID, startDate, endDate string) ([]KeywordPerfRow, error)
```

GAQL:
```sql
SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
       ad_group.name,
       metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions
FROM ad_group_criterion
WHERE campaign.id = {campaignID}
  AND ad_group_criterion.type = 'KEYWORD'
  AND ad_group_criterion.status != 'REMOVED'
  AND segments.date BETWEEN '{startDate}' AND '{endDate}'
ORDER BY metrics.cost_micros DESC
```

Compute CPA and CTR in Go. Limit to top 50 keywords by cost. Return empty slice if no data.

---

### 2. Backend — New Endpoints (add to `admin_google_ads.go`)

#### `GET /admin/tenants/{tenant}/campaigns/live/{id}/search-terms`
Query params: `startDate`, `endDate` (optional; default last 30 days)
- Call `GetSearchTerms(ctx, campaignID, startDate, endDate)`
- Return JSON array

#### `GET /admin/tenants/{tenant}/campaigns/live/{id}/quality-scores`
No date params (QS is not time-segmented)
- Call `GetKeywordQualityScores(ctx, campaignID)`
- Return JSON array

#### `GET /admin/tenants/{tenant}/campaigns/live/{id}/keywords`
Query params: `startDate`, `endDate` (optional; default last 30 days)
- Call `GetKeywordPerformance(ctx, campaignID, startDate, endDate)`
- Return JSON array

Register all three routes in the same router group as existing campaign live routes.

---

### 3. Frontend — API Client (`$lib/api/campaigns.ts`)

```ts
export interface SearchTermRow {
  term: string
  status: string
  clicks: number
  impressions: number
  cost: number
  conversions: number
  cpa: number
  ctr: number
}

export interface KeywordQSRow {
  keywordText: string
  matchType: string
  adGroupName: string
  qualityScore: number    // 0 = N/A
  creativeQS: string
  postClickQS: string
  predictedCTR: string
}

export interface KeywordPerfRow {
  keywordText: string
  matchType: string
  adGroupName: string
  clicks: number
  impressions: number
  cost: number
  conversions: number
  cpa: number
  ctr: number
}

export const getSearchTerms       = (tenantId, campaignId, params, fetchFn?) => ...
export const getKeywordQualityScores = (tenantId, campaignId, fetchFn?) => ...
export const getKeywordPerformance = (tenantId, campaignId, params, fetchFn?) => ...
```

In `+page.ts`, add to `streamed`:
```ts
searchTerms:    withFallback(getSearchTerms(params.tenant, params.campaign_id, { startDate, endDate }, fetch), []),
qualityScores:  withFallback(getKeywordQualityScores(params.tenant, params.campaign_id, fetch), []),
keywords:       withFallback(getKeywordPerformance(params.tenant, params.campaign_id, { startDate, endDate }, fetch), []),
```

Pass all three to `<LiveTab>` via `+page.svelte`. Update `LiveTab` props.

---

### 4. Frontend — New Components

#### `components/search-terms-table.svelte`
**Props:** `{ terms: SearchTermRow[] }`

If empty, show "No search term data available for this period".

Split terms into two sections (computed, not from API):
- **Converting terms** (`conversions > 0`): sorted by conversions desc
- **High-cost, no conversion** (`conversions === 0 && cost > avgCostPerTerm`): sorted by cost desc, limit 20

For each section, render a compact table:
| Search Term | Clicks | Conversions | Cost | CPA | CTR | Status |

`Status` column: "EXCLUDED" → show `<Badge color="red">Negative</Badge>`; "ADDED" → `<Badge color="green">Keyword</Badge>`; "NONE" → empty.

Add a `<button>` "Copy as CSV" that exports the high-cost/no-conversion list to clipboard as CSV (term, cost, clicks columns) — useful for bulk negative keyword upload. Use `navigator.clipboard.writeText()`.

Card title: **"Search Terms Report"**. Note: "Converting terms are candidates for exact match keywords. High-cost/no-conversion terms are candidates for negatives."

#### `components/quality-score-table.svelte`
**Props:** `{ keywords: KeywordQSRow[] }`

If empty, show "No keyword data available".

Render a table with a color-coded QS badge per keyword:
- QS 0 → "N/A" (gray)
- QS 1–4 → red badge "Poor"
- QS 5–7 → amber badge "OK"
- QS 8–10 → green badge "Good"

Columns: | Keyword | Match Type | Ad Group | Quality Score | Creative QS | Landing Page | Pred. CTR |

For "Creative QS", "Landing Page" (postClickQS), and "Pred. CTR": map "BELOW_AVERAGE"→🔴, "AVERAGE"→🟡, "ABOVE_AVERAGE"→🟢 (use colored dots, not emoji in production — use `<span class="rounded-full w-2 h-2 bg-red-500">` etc.)

Sort by QS ascending (worst first) so problems surface at the top.

Show a summary above the table: "X keywords with QS < 5 (action needed)" in red if any.

Card title: **"Keyword Quality Scores"**.

#### `components/keyword-performance-table.svelte`
**Props:** `{ keywords: KeywordPerfRow[] }`

If empty, show "No keyword performance data for this period".

Render a sortable table (client-side sort on column header click, default sort: cost desc):
| Keyword | Match | Ad Group | Clicks | Impressions | Cost | Conversions | CPA | CTR |

Use `brl()` for cost and CPA. Show "—" for CPA when conversions === 0.

Match type badge: "BROAD" (slate), "PHRASE" (blue), "EXACT" (emerald) — small pill badges.

Add a filter input above the table: text search on keyword text (filters in real-time, no server call).

Card title: **"Keyword Performance"**. 

---

### 5. Integration in `tabs/live.svelte`

Update props to receive `searchTerms`, `qualityScores`, `keywords` promises. Add at the bottom of the `{#if d}` block:

```svelte
{#await qualityScores then qs}
  {#if qs.length > 0}<QualityScoreTable keywords={qs} />{/if}
{/await}

{#await keywords then kw}
  {#if kw.length > 0}<KeywordPerformanceTable keywords={kw} />{/if}
{/await}

{#await searchTerms then terms}
  {#if terms.length > 0}<SearchTermsTable {terms} />{/if}
{/await}
```

Each `{#await}` should show a skeleton while loading.

---

## Edge Cases & Error Handling
- `search_term_view` + `segments.date` may be unsupported for some account types — implement the fallback retry described in §1a
- Keywords with QS = 0 mean "insufficient data", not "broken" — label as "N/A"
- Smart Campaigns (`isSmartManaged()`) don't have keyword-level data — check this in the Live tab and hide QS/keyword components if `d.campaign.adGroups` matches the smart campaign pattern
- Copy-to-clipboard may fail in non-HTTPS contexts — wrap in try/catch with a fallback that shows the CSV in a `<textarea>` modal

## i18n
Add all new string keys to both `locales/en/ads.json` and `locales/pt-BR/ads.json`.

## Definition of Done
- [ ] `search_intelligence.go` created with 3 connector functions
- [ ] 3 new endpoints registered in `admin_google_ads.go`
- [ ] New types and fetch functions in `campaigns.ts`
- [ ] `+page.ts` streams 3 new data sources
- [ ] 3 new frontend components created and integrated
- [ ] Smart Campaign guard in place (hide keyword components for smart campaigns)
- [ ] Search terms CSV copy works with try/catch fallback
- [ ] `go build ./...` and `bun run build` pass cleanly


