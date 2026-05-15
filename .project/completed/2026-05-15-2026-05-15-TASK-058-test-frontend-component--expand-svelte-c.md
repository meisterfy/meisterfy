---
title: "test: frontend component — expand Svelte component coverage (social, integrations, ui primitives)"
created: 2026-05-15T14:35:25.612Z
priority: P2-L
status: backlog
tags: [test]
---

# test: frontend component — expand Svelte component coverage (social, integrations, ui primitives)

## Context
118 Svelte components exist; only 3 have tests (edit-post-drawer, new-post-drawer, status-badge). This task expands component coverage to the most user-facing and logic-heavy components, following the pattern already established in `edit-post-drawer.svelte.test.ts`.

All tests use `vitest-browser-svelte` (Playwright Chromium) — the `client` project in vitest config. They test real browser behavior, not JSDOM.

## Pattern (from existing tests)
```typescript
import { render } from 'vitest-browser-svelte'
import { expect, test, vi } from 'vitest'
import MyComponent from './my-component.svelte'

test('description of observable behavior', async () => {
  const screen = await render(MyComponent, { prop: value })
  await expect.element(screen.getByRole('button', { name: /Submit/i })).toBeVisible()
})
```

Mock heavy dependencies (drawers, dialogs, external components) using `__test-mocks__/passthrough.svelte` as established.

---

## Files to create (grouped by feature area)

### Social / Post Management
- `src/lib/components/social/post-card.svelte.test.ts`
  - shows post title, content preview, status badge
  - shows correct action buttons per status (draft vs published)
  - emits click event on action button

### Integrations
- `src/lib/components/ui/integration-card/integration-card.svelte.test.ts` (if component exists)
  - shows provider name and status
  - connected state shows disconnect button
  - pending state shows connect button
  - emits connect/disconnect events

### UI Primitives (build on status-badge model)
- `src/lib/components/ui/platform-select/platform-select.svelte.test.ts`
  - renders platform options
  - selecting a platform updates value
  - multiple selection works

- `src/lib/components/ui/confirm-dialog/confirm-dialog.svelte.test.ts`
  - shows title and message
  - Confirm button calls onConfirm
  - Cancel button calls onCancel
  - does not render when open=false

### Form Validation
- Any form component that has required field validation:
  - disabled submit when required fields empty
  - enables submit when all required fields filled
  - shows error message on invalid input

---

## Discovery step (do this first)
Before writing tests, run:
```bash
find src/lib/components -name "*.svelte" | sort
```
Then prioritize components that:
1. Have business logic (conditional rendering, form validation, event emission)
2. Are used in multiple pages (high blast radius if they regress)
3. Accept props with distinct behavior branches

Skip purely presentational components (no logic, no events) — they're not worth testing.

---

## Mock strategy
Follow the existing `__test-mocks__/` pattern in `src/lib/components/social/`:
- `passthrough.svelte` — renders `<slot />` for wrapping components (drawers, dialogs)
- `platform-select.svelte` — simplified mock for the platform selector

Create additional mocks in the same `__test-mocks__/` directory as needed.

---

## What NOT to test
- Pure CSS/layout components (no logic)
- Generated paraglide i18n files
- Third-party component wrappers with no logic of their own

---

## Target
Minimum 10 new test files covering at least 15 components total (3 existing + 12 new).

## Acceptance criteria
- `bun run test:unit -- --run` passes with all new tests
- All new tests use `vitest-browser-svelte` (browser project, not node)
- Every test has at least one `await expect.element(...)` assertion
- No flaky tests (avoid fixed timeouts — use `await expect.element()` which auto-retries)
- Components with conditional rendering: all branches tested (e.g., draft vs published post)

## Dependencies
- TASK-057 (coverage config in vite.config.ts should be set up first)
- No backend dependencies


