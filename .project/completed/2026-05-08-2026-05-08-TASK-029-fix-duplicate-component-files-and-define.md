---
title: "Fix duplicate component files and define missing PostShape type"
created: 2026-05-08T21:21:34.126Z
priority: P1-S
status: backlog
tags: [fix]
---

# Fix duplicate component files and define missing PostShape type

## Context
Two pairs of component files exist with different casing but 100% identical content (Linux is case-sensitive, so both coexist). Additionally, `PostShape` is imported in two components but never defined in `$lib/social.ts`.

## How to Start
1. Run `git status` to confirm clean working tree
2. Read the file pairs to confirm they are identical:
   - `frontend/src/lib/components/ui/drawer/Drawer.svelte` vs `drawer.svelte`
   - `frontend/src/lib/components/ui/multiselect/MultiSelect.svelte` vs `multi-select.svelte`
3. Run `grep -r "Drawer.svelte\|MultiSelect.svelte\|multi-select.svelte\|drawer.svelte" frontend/src --include="*.svelte" --include="*.ts" -l` to find all importers

## Implementation

### Step 1 — Duplicate files
For each pair, keep the kebab-case version (CLAUDE.md rule: "Svelte, JS and TS files must be kebab-case"):
- Keep `drawer.svelte`, delete `Drawer.svelte`
- Keep `multi-select.svelte`, delete `MultiSelect.svelte`
Update all imports across the codebase to use the kebab-case filename.

### Step 2 — Define PostShape
Open `frontend/src/lib/social.ts` and inspect what fields `PostShape` is expected to have by reading:
- `frontend/src/lib/components/social/post-editor-drawer.svelte`
- `frontend/src/lib/components/social/calendar-widget.svelte`

Then look at the `Post` type in `frontend/src/lib/api/posts.ts` and understand what extra fields the local pages add (`client_id`, `media_files`, `platform`).

Define and export `PostShape` in `frontend/src/lib/social.ts` as a type that extends or wraps `Post` with those additional client-side fields.

Make sure both components now import `PostShape` successfully.

## How to Verify Completion
- `grep -r "Drawer.svelte\|MultiSelect.svelte" frontend/src` returns no results
- `cd frontend && npx svelte-check --output human 2>&1 | grep -i "postshape\|cannot find\|error"` returns no type errors related to PostShape
- App compiles: `cd frontend && npm run build` exits 0

## Definition of Done
- No duplicate component files exist
- `PostShape` is exported from `$lib/social` and resolves correctly in both components
- All imports updated, no broken references
- Build passes

