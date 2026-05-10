---
title: "Refactor live campaign page: extract MetricCard, PerformanceChart, wowDelta util"
created: 2026-05-08T21:30:22.826Z
priority: P1-M
status: backlog
tags: [refactor]
---

# Refactor live campaign page: extract MetricCard, PerformanceChart, wowDelta util

## Context
frontend/src/routes/[tenant]/ads/google/live/[campaign_id]/+page.svelte is 698 lines and violates SRP: it handles delta calculations, Chart.js lifecycle (init/destroy), export logic, period selection, metric cards rendering, monthly summary, and ad groups table — all inline.

## How to Start
1. Read the full page: frontend/src/routes/[tenant]/ads/google/live/[campaign_id]/+page.svelte
2. Identify the logical sections:
   - wowDelta() function (~lines 51-65): week-over-week delta calculation
   - Chart.js setup/teardown (~lines 69-188): canvas refs, chart instances, $effect for init/destroy
   - Export function (~lines 192-216)
   - Period selector state and handler (~lines 218-228)
   - Metric cards HTML (~lines 375-523): the grid of KPI cards
   - Monthly summary section (~lines 557-597)
   - Ad groups table (~lines 598+)
3. Check if Chart.js is already imported from a shared location or directly
4. Read frontend/src/routes/[tenant]/ads/google/live/[campaign_id]/+page.ts for data types

## Implementation

### Step 1 - Create frontend/src/lib/utils/metrics.ts
Move wowDelta() to this utility file and export it:
```typescript
export function wowDelta(
  cur: number,
  prev: number,
  lowerIsBetter = false
): { pct: string; dir: 'up' | 'down' | 'flat' } {
  // existing implementation
}
```

### Step 2 - Create MetricCard component
Create frontend/src/lib/components/ads/metric-card.svelte
Props: label (string), value (string | number), delta? ({ pct: string; dir: string }), unit? (string), tooltip? (string)
This replaces the repeated metric card HTML blocks in lines ~375-523.

### Step 3 - Create PerformanceChart component
Create frontend/src/lib/components/ads/performance-chart.svelte
Props: data (the chart data arrays), labels (string[]), title? (string)
Encapsulates all Chart.js canvas, instance, $effect for init/destroy/update.
The parent page passes data; the component manages Chart.js lifecycle internally.

### Step 4 - Simplify the page
Replace the inline chart code with <PerformanceChart />, replace metric card HTML blocks with <MetricCard /> components, import wowDelta from $lib/utils/metrics.
Target: reduce from 698 lines to ~200 lines.

## How to Verify Completion
- wc -l frontend/src/routes/[tenant]/ads/google/live/[campaign_id]/+page.svelte shows <= 250 lines
- cd frontend && npm run build exits 0
- Live campaign page loads, charts render, metric cards show correct values with deltas
- svelte-check reports no new errors

## Definition of Done
- frontend/src/lib/utils/metrics.ts with wowDelta() exported
- metric-card.svelte and performance-chart.svelte created in frontend/src/lib/components/ads/
- Page reduced to composition only
- Build and type-check pass

