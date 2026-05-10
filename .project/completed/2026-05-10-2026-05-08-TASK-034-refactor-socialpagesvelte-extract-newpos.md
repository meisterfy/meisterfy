---
title: "Refactor social/+page.svelte: extract NewPostDrawer, EditPostDrawer and DeleteConfirmDialog"
created: 2026-05-08T21:28:03.359Z
priority: P1-L
status: backlog
tags: [refactor]
---

# Refactor social/+page.svelte: extract NewPostDrawer, EditPostDrawer and DeleteConfirmDialog

## Context
frontend/src/routes/[tenant]/social/+page.svelte is 770 lines and handles 5 separate concerns in a single component, violating SRP. It manages the calendar view, new post creation drawer, post editing drawer, delete confirmation dialog, and navigation state all together.

IMPORTANT: This task depends on TASK-031 (StatusBadge) and TASK-033 (parseHashtags, normalizePost). Complete those first if not already done, or work independently and import the new utilities.

## How to Start
1. Read the full file: frontend/src/routes/[tenant]/social/+page.svelte
2. Identify the section boundaries:
   - Script/state section (lines ~1-100): calendar state, post state, drawer state
   - New post drawer logic (look for showNewDrawer, newTitle, newContent, etc.)
   - Edit post drawer logic (look for showEditDrawer, editTitle, editContent, etc.)
   - Delete confirmation (look for showDeleteConfirm, isDeletingPost)
   - Calendar grid HTML (the main template)
3. Read frontend/src/routes/[tenant]/social/drafts/+page.svelte to understand shared patterns (do NOT merge the files; just understand what logic is shared)

## Implementation

### Step 1 - Create NewPostDrawer component
Create frontend/src/lib/components/social/new-post-drawer.svelte
Props it should receive: tenant (string), onCreated (callback), defaultDate? (string)
Internally manages: all new post form state (title, content, hashtags, platforms, date, time, media)
Emits: onCreated(newPost) when saved successfully
Includes: media upload using uploadMedia() from $lib/api/media
Includes: parseHashtags() from $lib/utils/hashtags

### Step 2 - Create EditPostDrawer component  
Create frontend/src/lib/components/social/edit-post-drawer.svelte
Props: post (PostShape | null), tenant (string), onSaved (callback), onDeleted (callback)
Internally manages: edit form state, delete confirmation
Emits: onSaved(updatedPost), onDeleted(postId)

### Step 3 - Simplify +page.svelte
Replace the drawer HTML sections and their corresponding script logic with the two new components. The page should now only manage:
- Calendar state (currentMonth, currentYear, navigation)
- The posts list (loaded from data)
- Which post is selected for editing (selectedPost)
- Passing selectedPost to EditPostDrawer and receiving callbacks

Target: reduce from 770 lines to ~200-250 lines.

## How to Verify Completion
- wc -l frontend/src/routes/[tenant]/social/+page.svelte shows <= 280 lines
- cd frontend && npm run build exits 0
- svelte-check reports no new errors
- Social calendar page loads, posts are visible, clicking a post opens edit drawer, new post button opens create drawer

## Definition of Done
- new-post-drawer.svelte and edit-post-drawer.svelte created in frontend/src/lib/components/social/
- +page.svelte reduced to calendar + composition only
- All existing functionality preserved
- Build and type-check pass

