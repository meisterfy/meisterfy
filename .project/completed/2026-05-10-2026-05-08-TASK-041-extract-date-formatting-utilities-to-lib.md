---
title: "Extract date formatting utilities to $lib/utils/date.ts"
created: 2026-05-08T23:09:46.701Z
priority: P3
status: backlog
tags: [refactor]
---

# Extract date formatting utilities to $lib/utils/date.ts

## Context
Date formatting functions (formatTs, formatDate) with similar logic are duplicated in the schedule and alerts route pages. Low severity but completes the utils cleanup.

## How to Start
1. Read the two files with date formatting:
   - frontend/src/routes/[tenant]/schedule/+page.svelte (look for formatTs and formatDate functions, ~lines 8-26)
   - frontend/src/routes/[tenant]/alerts/+page.svelte (look for date formatting, ~lines 45-51)
2. Note exact locale, options, and behavior differences between the two implementations

## Implementation

### Create frontend/src/lib/utils/date.ts
Based on the actual implementations found, create exported functions:
```typescript
export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDateStr(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}
```
Adjust the function signatures and locale options to exactly match what the routes currently produce (read the implementations first — do not guess).

### Replace in route files
- Remove the local formatTs/formatDate function definitions from both route files
- Import from $lib/utils/date
- Verify existing date display still renders correctly

## How to Verify Completion
- grep -rn 'function formatTs\|function formatDate' frontend/src/routes/ returns 0 results
- cd frontend && npm run build exits 0
- Schedule and alerts pages still show correctly formatted dates

## Definition of Done
- frontend/src/lib/utils/date.ts created with exported formatting functions
- Both route files import from $lib/utils/date
- Formatting output unchanged
- Build passes

