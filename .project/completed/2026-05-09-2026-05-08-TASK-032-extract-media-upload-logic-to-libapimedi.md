---
title: "Extract media upload logic to $lib/api/media.ts"
created: 2026-05-08T21:27:03.648Z
priority: P1-S
status: backlog
tags: [refactor]
---

# Extract media upload logic to $lib/api/media.ts

## Context
The handleMediaUpload() function is duplicated in 3 route files with nearly identical logic: FormData construction, fetch POST to /api/media/:tenant/:id, response decoding, and state management.

## How to Start
1. Read the 3 current implementations:
   - frontend/src/routes/[tenant]/social/+page.svelte (look for handleMediaUpload, ~lines 164-181)
   - frontend/src/routes/[tenant]/social/drafts/+page.svelte (~lines 175-194)
   - frontend/src/routes/[tenant]/social/[post_id]/+page.svelte (~lines 86-108)
2. Note differences between them (if any) to ensure the shared function covers all cases

## Implementation

### Step 1 - Create frontend/src/lib/api/media.ts
Create the file with:
```typescript
export async function uploadMedia(
  tenant: string,
  postId: string,
  files: FileList
): Promise<string[]> {
  const fd = new FormData()
  for (let i = 0; i < files.length; i++) fd.append('file', files[i])
  const res = await fetch(`/api/media/${tenant}/${postId}`, {
    method: 'POST',
    body: fd
  })
  if (!res.ok) throw new Error(await res.text())
  const data: { media_files: string[] } = await res.json()
  return data.media_files
}
```
Note: Use the actual fetch (not apiFetch) since this sends multipart/form-data, not JSON.

### Step 2 - Replace duplicates in the 3 route files
For each file:
- Import uploadMedia from $lib/api/media
- Replace the inline handleMediaUpload logic with a call to uploadMedia()
- Keep local state updates (isUploadingMedia, editMediaFiles, etc.) in the component — only extract the fetch+FormData logic
- Clear the input value after success as before

Example refactored handler:
```typescript
async function handleMediaUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  isUploadingMedia = true
  try {
    const urls = await uploadMedia(data.tenant, postId, input.files)
    editMediaFiles = [...editMediaFiles, ...urls]
    input.value = ''
  } catch (e) {
    mediaError = e instanceof Error ? e.message : 'Upload failed'
  } finally {
    isUploadingMedia = false
  }
}
```
Adapt variable names to match each file's existing state variables.

## How to Verify Completion
- grep -rn 'new FormData()' frontend/src/routes/[tenant]/social/ returns 0 results
- cd frontend && npm run build exits 0
- File upload still works in the social calendar and drafts pages

## Definition of Done
- frontend/src/lib/api/media.ts created with uploadMedia() exported
- All 3 route-level handleMediaUpload implementations replaced
- Build passes

