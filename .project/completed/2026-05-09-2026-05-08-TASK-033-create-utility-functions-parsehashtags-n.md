---
title: "Create utility functions: parseHashtags, normalizePost, normalizeCampaign"
created: 2026-05-08T21:27:22.360Z
priority: P1-S
status: backlog
tags: [refactor]
---

# Create utility functions: parseHashtags, normalizePost, normalizeCampaign

## Context
Three pieces of logic are duplicated across multiple page loaders and components:
1. Hashtag parsing: `.split(/\s+/).map(t => t.trim()).filter(Boolean)` — 4 files
2. Post normalization (add client_id, media_files, platform from raw API Post) — 3 page loaders
3. Campaign data extraction (c.data?.result) — 2 page loaders

## How to Start
1. Read the hashtag usages:
   - frontend/src/routes/[tenant]/social/+page.svelte (~lines 138-141)
   - frontend/src/routes/[tenant]/social/[post_id]/+page.svelte (~lines 112-115)
   - frontend/src/routes/[tenant]/social/drafts/+page.svelte (~lines 82-85)
   - frontend/src/routes/[tenant]/settings/general/+page.svelte (~lines 39-44)
2. Read the post normalization logic:
   - frontend/src/routes/[tenant]/social/+page.ts (~lines 6-14)
   - frontend/src/routes/[tenant]/social/drafts/+page.ts (~lines 11-18)
   - frontend/src/routes/[tenant]/social/[post_id]/+page.ts (~lines 18-22)
3. Read the campaign extraction:
   - frontend/src/routes/[tenant]/ads/google/+page.ts (~lines 6-18)
   - frontend/src/routes/[tenant]/ads/google/[slug]/+page.ts (~lines 12-14)
4. Read frontend/src/lib/api/posts.ts to understand the base Post type

## Implementation

### Step 1 - Create frontend/src/lib/utils/hashtags.ts
```typescript
export function parseHashtags(input: string): string[] {
  return input.split(/\s+/).map((t) => t.trim()).filter(Boolean)
}
```

### Step 2 - Create frontend/src/lib/utils/transforms.ts
Define normalizePost() based on the common .map() across the 3 social page loaders. The function takes a raw Post (from API) and returns an object with extra client-side fields. Read all 3 usages first to pick the superset of fields.

Also define normalizeCampaign() based on the extraction pattern in the ads pages.

### Step 3 - Replace all usages
- In the 4 svelte files using hashtag parsing: import parseHashtags and replace inline split logic
- In the 3 social page loaders (+page.ts files): import normalizePost and replace the .map() calls
- In the 2 ads page loaders: import normalizeCampaign and replace the .map() calls

## How to Verify Completion
- grep -rn 'split(/\\s+/)' frontend/src/routes/ returns 0 results
- cd frontend && npm run build exits 0
- svelte-check reports no new type errors

## Definition of Done
- frontend/src/lib/utils/hashtags.ts created with parseHashtags() exported
- frontend/src/lib/utils/transforms.ts created with normalizePost() and normalizeCampaign() exported
- All duplicate inline occurrences replaced
- Build passes

