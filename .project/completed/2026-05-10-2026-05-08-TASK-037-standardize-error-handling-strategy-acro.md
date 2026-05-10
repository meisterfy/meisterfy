---
title: "Standardize error handling strategy across all page loaders"
created: 2026-05-08T21:30:44.803Z
priority: P2-M
status: backlog
tags: [refactor]
---

# Standardize error handling strategy across all page loaders

## Context
Page loaders use 3 different and inconsistent error handling strategies: (1) silent .catch(() => []) with no user feedback, (2) try/catch with redirect to /login, (3) SvelteKit error() function for 404s. Some pages have no error handling at all. This makes debugging difficult and provides inconsistent UX.

## How to Start
1. Audit all +page.ts and +layout.ts files for error handling patterns:
   grep -rn 'catch\|error(' frontend/src/routes/ --include='*.ts' -l
2. Read each file to understand which strategy it uses:
   - frontend/src/routes/+page.ts
   - frontend/src/routes/settings/integrations/+page.ts
   - frontend/src/routes/[tenant]/alerts/+page.ts
   - frontend/src/routes/[tenant]/reports/+page.ts
   - frontend/src/routes/[tenant]/schedule/+page.ts
   - frontend/src/routes/[tenant]/ads/google/+page.ts
   - frontend/src/routes/[tenant]/social/+page.ts (no error handling currently)
   - frontend/src/routes/[tenant]/+layout.ts
3. Understand the difference between data-fetching errors (should show empty state) vs auth errors (should redirect) vs resource-not-found (should 404)

## Implementation

### Define the standard
Three cases, three strategies — make these explicit and consistent:

1. Auth/session errors (401, 403): redirect to /login
   Pattern: .catch((err) => { if (err.status === 401 || err.status === 403) redirect(302, '/login'); return defaultValue })

2. Resource not found (404): use SvelteKit error(404, message)
   Already used correctly in +layout.ts — keep this pattern

3. Optional data (lists, metrics): return empty default WITHOUT hiding the error from dev tools
   Pattern: .catch(() => []) is OK for lists, but add a console.error in development

### Apply consistently
- Routes that currently use .catch(() => []) silently: evaluate if auth redirect is needed (check if API requires auth)
- frontend/src/routes/[tenant]/social/+page.ts: add error handling (currently has none)
- Ensure isRedirect(err) is always re-thrown before fallback (already done in root +page.ts — apply same pattern everywhere)

### Create a helper (optional but recommended)
In frontend/src/lib/utils/loader.ts:
```typescript
export function withFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return promise.catch((err) => {
    if (err?.status === 401 || err?.status === 403) throw err // let layout handle redirect
    return fallback
  })
}
```
Use this in page loaders instead of raw .catch().

## How to Verify Completion
- All .catch(() => []) calls either use withFallback() or explicitly re-throw auth errors
- frontend/src/routes/[tenant]/social/+page.ts has error handling
- cd frontend && npm run build exits 0

## Definition of Done
- Consistent error handling applied to all page loaders
- Auth errors bubble up correctly in all routes
- Optional withFallback() utility created
- Build passes

