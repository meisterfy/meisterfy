---
title: "Refactor social/drafts/+page.svelte: extract CreateDraftDrawer, EditDraftDrawer, ScheduleDrawer, PublishDrawer"
created: 2026-05-08T21:30:06.171Z
priority: P1-L
status: backlog
tags: [refactor]
---

# Refactor social/drafts/+page.svelte: extract CreateDraftDrawer, EditDraftDrawer, ScheduleDrawer, PublishDrawer

## Context
frontend/src/routes/[tenant]/social/drafts/+page.svelte is 903 lines and violates SRP by managing 5 independent workflows in a single component: draft listing, creation, editing, scheduling, and publishing to Meta. Each workflow has its own drawer with independent state.

IMPORTANT: This task depends on TASK-031 (StatusBadge), TASK-032 (uploadMedia), TASK-033 (parseHashtags). Complete those first if not already done, or work independently and import the utilities.

## How to Start
1. Read the full file: frontend/src/routes/[tenant]/social/drafts/+page.svelte
2. Map the section boundaries:
   - Script state (beginning): identify all state variables and which drawer they belong to
   - Create drawer: look for showCreateDrawer state and corresponding HTML section
   - Edit drawer: look for showEditDrawer and its HTML section
   - Schedule drawer: look for showScheduleDrawer
   - Publish drawer: look for showPublishDrawer
   - List section: the main {#each} over drafts
3. Note: The edit logic here may overlap with TASK-034's EditPostDrawer — assess whether they can share the same component or need to be separate due to different fields

## Implementation

### Drawer components to create (in frontend/src/lib/components/social/)

1. create-draft-drawer.svelte
   - Props: tenant (string), onCreated (callback)
   - Manages: title, content, hashtags, platforms, media form state
   - On save: calls POST API, emits onCreated(newDraft)

2. edit-draft-drawer.svelte (or reuse edit-post-drawer if identical enough)
   - Props: draft (PostShape | null), tenant (string), onSaved (callback), onDeleted (callback)
   - Manages: all edit form state internally
   - Note: If edit-post-drawer.svelte from TASK-034 covers all necessary fields, import that instead of creating a new file

3. schedule-drawer.svelte
   - Props: draft (PostShape | null), tenant (string), onScheduled (callback)
   - Manages: date/time picker state
   - On confirm: calls schedule API, emits onScheduled()

4. publish-drawer.svelte
   - Props: draft (PostShape | null), tenant (string), onPublished (callback)
   - Manages: publish confirmation, target account selection (if any)
   - On confirm: calls publish API, emits onPublished()

### Simplify drafts/+page.svelte
Replace the 4 drawer HTML blocks and their script logic with the 4 components. The page should only manage:
- The drafts list (reactive, refreshed after callbacks)
- Which draft is selected for each action (selectedForEdit, selectedForSchedule, selectedForPublish)
- The filter/sort state (if any)

Target: reduce from 903 lines to ~200-250 lines.

## How to Verify Completion
- wc -l frontend/src/routes/[tenant]/social/drafts/+page.svelte shows <= 280 lines
- cd frontend && npm run build exits 0
- All 4 drawer workflows still work: create draft, edit draft, schedule, publish
- svelte-check reports no new errors

## Definition of Done
- 4 drawer components created (or schedule/publish reuse existing where applicable)
- drafts/+page.svelte reduced to list + composition only
- All functionality preserved
- Build and type-check pass

