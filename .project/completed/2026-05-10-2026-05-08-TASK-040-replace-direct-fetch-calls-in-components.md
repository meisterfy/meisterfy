---
title: "Replace direct fetch() calls in components and auth store with apiFetch"
created: 2026-05-08T23:09:27.510Z
priority: P2-S
status: backlog
tags: [refactor]
---

# Replace direct fetch() calls in components and auth store with apiFetch

## Context
Several Svelte components and the auth store call fetch() directly with manual header construction instead of using the apiFetch() abstraction from $lib/api/client.ts. This violates DIP and means auth headers/error handling aren't centralized.

## How to Start
1. Find all direct fetch() calls in non-page-loader files:
   grep -rn 'await fetch(' frontend/src/lib/ --include='*.ts' --include='*.svelte'
   grep -rn 'await fetch(' frontend/src/routes/ --include='*.svelte'
2. Specifically check:
   - frontend/src/lib/stores/auth.svelte.ts (lines ~48-50): calls fetch('/auth/me') manually
   - frontend/src/routes/[tenant]/social/+page.svelte: any remaining direct fetch calls after TASK-032
   - frontend/src/routes/[tenant]/social/drafts/+page.svelte: same
   - frontend/src/routes/[tenant]/social/[post_id]/+page.svelte: same
3. Read frontend/src/lib/api/client.ts to understand apiFetch signature and what it handles (auth headers, credentials, error throwing)

## Implementation

### auth.svelte.ts
The auth store calls fetch('/auth/me') manually with conditional Authorization header. Check if apiFetch handles credentials: 'include' and auth headers the same way. If yes, replace with apiFetch. If auth.svelte.ts is called during initialization before the token is set, it may need special handling — read carefully before replacing.

If apiFetch cannot be used (circular import risk between store and client), at minimum document why with a comment so future readers understand the intent.

### Route components (after TASK-032)
After the media upload extraction (TASK-032), verify no remaining direct fetch() calls exist in Svelte route components for non-file-upload use cases. For JSON API calls, replace with apiFetch.

Note: File uploads using FormData/multipart CANNOT use apiFetch if it sets Content-Type: application/json. These should use fetch() directly or be routed through uploadMedia() (TASK-032). Keep those as-is.

## How to Verify Completion
- grep -rn 'await fetch(' frontend/src/lib/ shows 0 results OR only commented/justified exceptions
- grep -rn 'await fetch(' frontend/src/routes/ --include='*.svelte' shows only file upload calls
- cd frontend && npm run build exits 0
- Auth still works (login, token refresh, /auth/me)

## Definition of Done
- auth.svelte.ts either uses apiFetch or has a documented justification comment for using raw fetch
- All JSON API calls in Svelte components use apiFetch
- Only file upload calls (FormData) remain as direct fetch()
- Build passes

