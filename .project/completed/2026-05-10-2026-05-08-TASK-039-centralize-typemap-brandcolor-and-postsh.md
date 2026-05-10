---
title: "Centralize TYPE_MAP, BRAND_COLOR and PostShape — eliminate scattered constants"
created: 2026-05-08T21:31:19.820Z
priority: P2-S
status: backlog
tags: [refactor]
---

# Centralize TYPE_MAP, BRAND_COLOR and PostShape — eliminate scattered constants

## Context
Three constants/types are defined in multiple places:
1. TYPE_MAP (report/alert type labels and colors) — defined in reports/+page.ts and +page.svelte, also hardcoded in alerts/+page.svelte and schedule/+page.svelte
2. BRAND_COLOR (platform brand colors) — defined in platform-select.svelte AND calendar-widget.svelte
3. PostShape type — imported from $lib/social but not defined there; local variants exist in social/+page.svelte and social/drafts/+page.svelte

## How to Start
1. Run: grep -rn 'TYPE_MAP\|BRAND_COLOR\|PostShape' frontend/src/ --include='*.ts' --include='*.svelte'
2. Read each occurrence to understand the full shape of each constant
3. Read frontend/src/lib/social.ts to understand what's already exported
4. Read frontend/src/lib/api/posts.ts to understand the base Post type

## Implementation

### Step 1 - Centralize TYPE_MAP
Create frontend/src/lib/constants/type-maps.ts (or add to existing constants file if one exists):
```typescript
export const REPORT_TYPE_MAP: Record<string, { label: string; color: string }> = {
  audit: { label: 'Audit', color: 'amber' },
  search: { label: 'Search Campaign', color: 'blue' },
  report: { label: 'Report', color: 'slate' },
  // ... complete list from reading all current definitions
}
```
Remove TYPE_MAP from reports/+page.ts and reports/+page.svelte. Import from $lib/constants/type-maps in all routes that reference it.

### Step 2 - Centralize BRAND_COLOR
Add BRAND_COLOR export to frontend/src/lib/social.ts:
```typescript
export const BRAND_COLOR: Record<string, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  // ... complete list from reading both current definitions
}
```
Remove the duplicate definition from calendar-widget.svelte. Both platform-select.svelte and calendar-widget.svelte should import from $lib/social.

### Step 3 - Define PostShape in $lib/social.ts
Based on usage in post-editor-drawer.svelte and calendar-widget.svelte, and the local variants in social/+page.svelte and drafts/+page.svelte, define:
```typescript
import type { Post } from '$lib/api/posts'
export type PostShape = Post & {
  client_id: string
  media_files: string[]
  platform: string | null
  scheduled_date?: string
}
```
Remove the local PostShape/equivalent type definitions from social/+page.svelte and social/drafts/+page.svelte. Import PostShape from $lib/social in those files.

## How to Verify Completion
- grep -rn 'TYPE_MAP\|BRAND_COLOR' frontend/src/routes/ returns 0 results (all moved to lib)
- grep -rn 'type Post\|interface Post' frontend/src/routes/ returns 0 local type definitions
- cd frontend && npm run build exits 0
- svelte-check reports no new errors

## Definition of Done
- REPORT_TYPE_MAP in frontend/src/lib/constants/
- BRAND_COLOR exported from $lib/social
- PostShape exported from $lib/social and used in place of all local variants
- Build and type-check pass

