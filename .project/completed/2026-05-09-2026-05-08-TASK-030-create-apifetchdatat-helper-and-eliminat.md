---
title: "Create apiFetchData<T> helper and eliminate .then((r) => r.data) duplication"
created: 2026-05-08T21:21:48.942Z
priority: P1-M
status: backlog
tags: [refactor]
---

# Create apiFetchData<T> helper and eliminate .then((r) => r.data) duplication

## Context
Every function in all API modules manually unwraps the `{ data: T }` response envelope using `.then((r) => r.data)`. This pattern appears 18+ times across 8 files. The fix is a single helper in the API client.

## How to Start
1. Read `frontend/src/lib/api/client.ts` fully — this is the base `apiFetch<T>()` function
2. Run `grep -rn ".then((r) => r.data)" frontend/src/lib/api/` to list all occurrences (expect 18+)
3. Note that ALL occurrences follow the same pattern: `apiFetch<{ data: T }>(path).then((r) => r.data)`

## Implementation

### Step 1 — Add helper to client.ts
In `frontend/src/lib/api/client.ts`, add after the `apiFetch` function:
```typescript
export async function apiFetchData<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch<{ data: T }>(path, options)
  return response.data
}
```

### Step 2 — Refactor all API modules
For each of the following files, replace every `apiFetch<{ data: T }>(path, opts).then((r) => r.data)` with `apiFetchData<T>(path, opts)`:
- `frontend/src/lib/api/posts.ts` (lines ~31, 37, 43, 49, 60)
- `frontend/src/lib/api/campaigns.ts` (lines ~14, 19, 25, 34)
- `frontend/src/lib/api/reports.ts` (lines ~19, 24, 33)
- `frontend/src/lib/api/alerts.ts` (lines ~21, 27)
- `frontend/src/lib/api/tenants.ts` (lines ~27, 30, 41)
- `frontend/src/lib/api/integrations.ts` (lines ~52, 73, 79)
- `frontend/src/lib/api/users.ts` (line ~8)
- `frontend/src/lib/api/connector_resources.ts` (lines ~26, 46)

For each function, change the return type annotation and the call. Example:
```typescript
// Before
export async function getPosts(tenant: string, fetch?: Fetch): Promise<Post[]> {
  return apiFetch<{ data: Post[] }>(`/api/posts/${tenant}`, { ... }).then((r) => r.data)
}

// After
export async function getPosts(tenant: string, fetch?: Fetch): Promise<Post[]> {
  return apiFetchData<Post[]>(`/api/posts/${tenant}`, { ... })
}
```

## How to Verify Completion
- `grep -rn ".then((r) => r.data)" frontend/src/lib/api/` returns 0 results
- `cd frontend && npm run build` exits 0
- `cd frontend && npx svelte-check --output human 2>&1 | grep -c error` returns 0

## Definition of Done
- `apiFetchData<T>()` exported from `client.ts`
- All 18 `.then((r) => r.data)` patterns replaced
- TypeScript types preserved correctly
- Build passes with no new errors

