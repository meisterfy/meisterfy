---
title: "Create StatusBadge.svelte component to eliminate status badge duplication"
created: 2026-05-08T21:26:00.895Z
priority: P1-S
status: backlog
tags: [refactor]
---

# Create StatusBadge.svelte component to eliminate status badge duplication

## Context
Status badge rendering (draft/approved/scheduled/published) with conditional color classes is reimplemented in 6+ places. A shared component will eliminate all duplicates.

## How to Start
1. Read the current badge implementations in:
   - frontend/src/lib/components/social/post-card.svelte (lines ~32-45)
   - frontend/src/lib/components/social/list-view.svelte (lines ~42-52)
   - frontend/src/lib/components/social/post-editor-drawer.svelte (lines ~169-172)
   - frontend/src/routes/[tenant]/social/+page.svelte (lines ~538-620)
   - frontend/src/routes/[tenant]/social/drafts/+page.svelte (lines ~391-561)
   - frontend/src/routes/[tenant]/social/[post_id]/+page.svelte (lines ~442-451)
2. List all unique status values: grep -rn 'status.*draft\|status.*scheduled\|status.*published\|status.*approved' frontend/src/routes/[tenant]/social/ --include='*.svelte'

## Implementation

### Step 1 - Create the component
Create frontend/src/lib/components/ui/status-badge/status-badge.svelte with a colorMap Record<string, string> mapping each status to its Tailwind classes. Use $props() to receive status: string. Unify the classes across all current implementations (keep the most complete version for each status).

### Step 2 - Replace all inline implementations
For each of the 6 files, replace the inline badge HTML with <StatusBadge status={post.status} /> and add the import from $lib/components/ui/status-badge/status-badge.svelte.

## How to Verify Completion
- grep -rn 'rounded-full.*draft\|bg-slate-100.*uppercase' frontend/src/routes/[tenant]/social/ returns 0 results
- cd frontend && npm run build exits 0
- svelte-check reports no new errors

## Definition of Done
- status-badge.svelte created handling all status values with correct colors
- All 6 inline implementations replaced with the shared component
- Build passes with no new errors

