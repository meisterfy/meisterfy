---
title: "Google Ads — Analytics Expansion Phase 1 (Frontend-only)"
created: 2026-05-12T02:33:21.082Z
priority: P1-L
status: backlog
tags: [feat]
---

# Google Ads — Analytics Expansion Phase 1 (Frontend-only)

## Goal
Add rich analytics to the Google Ads campaign detail page using data that already flows from the backend. **Zero backend changes** — everything is computed from existing `DbHistoryDay[]` and `LiveCampaignDetail` data already available in the page.

---

## Project Context
- **Route:** `frontend/src/routes/[tenant]/ads/google/live/[campaign_id]/`
- **Stack:** SvelteKit 5 (Svelte runes), TypeScript, Tailwind v4, Chart.js, bits-ui
- **Conventions:** kebab-case filenames, single quotes, no semicolons in TS, `$props<{}>()` syntax
- **i18n:** `m['ads:key']()` pattern from `$lib/paraglide/messages`

## Existing Data Structures (in `$lib/api/campaigns.ts`)

```ts
interface DbHistoryDay {
  date: string        // "YYYY-MM-DD"
  campaign_id: string
  cost: number        // BRL float
  conversions: number
  clicks: number
  impressions: number
  cpa: number         // BRL, 0 if no conversions that day
  budgetMicros?: number
}

interface LiveCampaignDetail {
  campaign: {
    metrics: { impressions: string; clicks: string; cost: string; conversions: string; cpa: string; ctr: string; searchImpressionShare: string }
    history: Array<{ date: string; clicks: number; impressions: number }>
    adGroups: AdGroup[]
  }
  wow: {
    cur:  { impressions: number; clicks: number; cost: number; conversions: number }
    prev: { impressions: number; clicks: number; cost: number; conversions: number }
  }
  budgetPacing: { date: string; cost: number; budget: number; pct: number } | null
  openAlerts: Array<{ id: string; level: string; type: string; message: string }>
  client: { id: string }
}
```

## Existing Utility Functions (read these files before starting)
- `$lib/utils/charts.ts` — `createPerformanceTimelineConfig`, `createDailyCostCpaConfig` (Chart.js config factories, follow this pattern for new charts)
- `$lib/utils/metrics.ts` — `wowDelta(cur, prev, isInverse?)` → `{ pct: string, dir: 'up'|'down'|'flat' }`
- `$lib/utils/format.ts` — `brl(value: number)` → formatted BRL string
- `$lib/components/ads/metric-card.svelte` — `{ icon, theme, label, value, subtitle?, delta }` props
- `$lib/components/ads/performance-chart.svelte` — `{ config, title, source, note?, icon }` props

## Entry Points (already exist, read before editing)
- `tabs/history.svelte` — receives `dbHistory: Promise<DbHistoryDay[]>`
- `tabs/live.svelte` — receives `detail: Promise<LiveCampaignDetail | null>`, `isLoadingPeriod`, `onSetPeriod`, `onClearPeriod`
- `components/` — existing shared components for this route

---

## Deliverables

### 1. `components/day-of-week-chart.svelte`
**Props:** `{ history: DbHistoryDay[] }`

Aggregate `history` by weekday. For each day of week (0=Sun…6=Sat) compute across all matching rows:
- `avgCost = total_cost / count_of_days_with_impressions`
- `avgCPA = total_cost / total_conversions` (null if no conversions)
- `avgCTR = (total_clicks / total_impressions) * 100` (null if no impressions)

Render **two** Chart.js bar charts (follow `createDailyCostCpaConfig` pattern for config factories):
- Chart A: "Avg Daily Cost" — bars for Sun–Sat
- Chart B: "Avg CPA" — bars for days that have conversions; skip days with avgCPA === null

Labels: `["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]`

Wrap in a card titled **"Performance by Day of Week"** with subtitle "Use this for bid schedule optimization".

If fewer than 14 days of history exist, show a notice "Need at least 14 days of data for reliable patterns" instead of charts.

### 2. `components/monthly-table.svelte`
**Props:** `{ history: DbHistoryDay[] }`

Group `history` by `date.substring(0, 7)` (YYYY-MM). For each month compute:
- `cost`: sum, `conversions`: sum, `clicks`: sum, `impressions`: sum
- `cpa`: cost / conversions (null if conversions === 0)
- `ctr`: (clicks / impressions) * 100 (null if impressions === 0)
- `activeDays`: count of rows with impressions > 0

Sort months **descending**. For each row (except the oldest), compute vs previous month:
- CPA trend: lower is better → green arrow if improved, red if regressed
- Cost trend: neutral (just show direction)
- Conversions trend: higher is better → green if improved

Render as a responsive table:
| Month | Cost | Conversions | CPA △ | CTR | Active Days |

Use `brl()` for cost and CPA. Show "—" for nulls. Trend arrows: ↑ (emerald) / ↓ (red) as `<span>` with color classes.

Card title: **"Month-over-Month Performance"**.

### 3. `components/spend-projection.svelte`
**Props:** `{ history: DbHistoryDay[] }`

Filter `history` to current month (`date.startsWith(currentYYYYMM)`). Compute:
- `daysElapsed`: count of rows in current month with data
- `daysInMonth`: total calendar days this month
- `currentSpend`: sum of cost this month
- `currentConversions`: sum of conversions this month
- `projectedSpend`: `(currentSpend / daysElapsed) * daysInMonth`
- `projectedConversions`: `(currentConversions / daysElapsed) * daysInMonth`
- `projectedCPA`: projectedSpend / projectedConversions (null if projectedConversions === 0)

If `daysElapsed === 0`, render nothing.

Render as a compact info card with 3 stat items: "Projected Spend", "Projected Conversions", "Projected CPA". Add subtext "Based on {daysElapsed} days of data".

Card title: **"End-of-Month Projection"**.

### 4. `components/performance-extremes.svelte`
**Props:** `{ history: DbHistoryDay[] }`

From `history`, filter to days with `conversions > 0`. Sort by `cpa` ascending.

Show:
- **Best 5 days**: lowest CPA — show date (DD/MM), CPA via `brl()`, conversions count
- **Worst 5 days**: highest CPA — same columns
- **Longest dry streak**: max consecutive days with `conversions === 0` → "X days without a conversion"

Render as two side-by-side lists (`grid-cols-2`) in a card titled **"Performance Extremes"**.

If fewer than 10 days with conversions exist, show "Not enough conversion data yet".

### 5. Live Tab — Two new MetricCards

In `tabs/live.svelte`, inside `{#if d}`, add after the existing 4 `<MetricCard />` calls:

**CVR (Conversion Rate):**
- Value: `(d.wow.cur.conversions / d.wow.cur.clicks * 100).toFixed(2) + '%'` — "—" if clicks === 0
- Delta: `wowDelta(d.wow.cur.conversions / d.wow.cur.clicks, d.wow.prev.conversions / d.wow.prev.clicks)` — handle division by zero
- Icon: `Percent` from lucide-svelte, theme: `"rose"` (add to MetricCard)

**CPC (Cost per Click):**
- Value: `brl(d.wow.cur.cost / d.wow.cur.clicks)` — "—" if clicks === 0
- Delta: `wowDelta(d.wow.cur.cost / d.wow.cur.clicks, d.wow.prev.cost / d.wow.prev.clicks, true)` — isInverse=true (lower CPC is better)
- Icon: `CreditCard` from lucide-svelte, theme: `"slate"` (add to MetricCard)

**Update `$lib/components/ads/metric-card.svelte`** to add `rose` and `slate` themes following the existing pattern:
```
rose:  { hover: 'hover:border-rose-200 dark:hover:border-rose-800',  iconBg: 'bg-rose-50 text-rose-500 dark:bg-rose-900/30' }
slate: { hover: 'hover:border-slate-300 dark:hover:border-slate-700', iconBg: 'bg-slate-100 text-slate-500 dark:bg-slate-800' }
```

Change the metric grid to `grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` for the 6 cards.

---

## Integration Order in `tabs/history.svelte`

Inside `{#if resHistory.length > 0}`:
1. `<SpendProjection history={resHistory} />`
2. `<MonthlyTable history={resHistory} />`
3. (existing) `{#if monthly}<MonthlyMetricsGrid metrics={monthly} />{/if}`
4. (existing) `<PerformanceChart ... />`
5. `<DayOfWeekChart history={resHistory} />`
6. `<PerformanceExtremes history={resHistory} />`

---

## i18n
Add any new string keys to both `locales/en/ads.json` and `locales/pt-BR/ads.json`. Follow existing key structure.

## Definition of Done
- [ ] 4 new components created and integrated in `tabs/history.svelte`
- [ ] CVR and CPC cards added to `tabs/live.svelte`
- [ ] `metric-card.svelte` updated with `rose` and `slate` themes
- [ ] All edge cases handled: empty arrays, division by zero, 0 conversions, < 14 days
- [ ] `bun run build` passes with no new TypeScript errors


