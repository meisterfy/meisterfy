---
title: "Brand settings UI + AI content generation in post editor"
created: 2026-05-01T18:58:30.121Z
priority: P1-S
status: backlog
tags: [feature]
---

# Brand settings UI + AI content generation in post editor

## Goal

Complete the brand settings UI and wire up the LLM stack (already implemented in backend) to the post editor.

## Gaps to fix

### 1. Settings/General — brand fields missing from UI
- Expose all brand fields already in the DB: `language`, `location`, `primary_persona`, `tone`, `instructions`, `hashtags`
- Remove `google_ads_id` from the settings form and from the `Tenant` TypeScript type (migration 000017 already dropped the column)

### 2. Frontend AI API client
- Create `frontend/src/lib/api/ai.ts`
- Consume `POST /api/ai/generate` with SSE streaming
- Payload: `{ tenant_id, provider?, model?, prompt, system? }`

### 3. Post editor — AI generation panel
- Add a "Generate with AI" button in `[tenant]/social/[filename]/+page.svelte`
- Opens a side panel where the user types a brief instruction
- System prompt is pre-populated with tenant brand context: `tone`, `niche`, `primary_persona`, `instructions`, `language`
- Response streams into the content field
- Provider/model selection optional (defaults to first available for tenant)

## Files
- `frontend/src/routes/[tenant]/settings/general/+page.svelte`
- `frontend/src/lib/api/tenants.ts` (remove google_ads_id)
- `frontend/src/lib/api/ai.ts` (new)
- `frontend/src/routes/[tenant]/social/[filename]/+page.svelte`
- `frontend/src/routes/[tenant]/social/[filename]/+page.ts` (load brand data)

## Backend reference
- Endpoint: `POST /api/ai/generate` (SSE)
- Payload: `{ tenant_id: string, prompt: string, system?: string, provider?: string, model?: string }`
- Stream events: `data: {"text": "..."}`, ends with `data: [DONE]`

