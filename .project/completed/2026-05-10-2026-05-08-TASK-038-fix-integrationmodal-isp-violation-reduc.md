---
title: "Fix IntegrationModal ISP violation: reduce from 14 props to manager context"
created: 2026-05-08T21:31:02.836Z
priority: P2-M
status: backlog
tags: [refactor]
---

# Fix IntegrationModal ISP violation: reduce from 14 props to manager context

## Context
frontend/src/routes/settings/integrations/components/integration-modal.svelte receives 14 bindable props, all coming from a manager object in the parent page. This is an Interface Segregation Principle violation: the component depends on the entire manager state instead of only what it needs. The fix is to pass the manager object directly and bind to its properties.

## How to Start
1. Read the modal component fully:
   frontend/src/routes/settings/integrations/components/integration-modal.svelte
2. Read the parent page to understand how the manager is structured:
   frontend/src/routes/settings/integrations/+page.svelte
3. Find where the manager is defined (likely a .svelte.ts store or inline in the page)
   grep -rn 'manager' frontend/src/routes/settings/integrations/ --include='*.ts' --include='*.svelte'
4. List all 14 props the modal currently receives

## Implementation

### Option A: Pass manager directly (preferred if manager is a reactive store/class)
If the manager is a Svelte 5 reactive object (.svelte.ts class), update the modal to:
```svelte
<script lang="ts">
  import type { IntegrationManager } from '../integration-manager.svelte'
  const { manager }: { manager: IntegrationManager } = $props()
</script>
```
Then reference manager.showModal, manager.form, manager.isSubmitting etc. directly.
In the parent, replace the 14 individual prop bindings with: <IntegrationModal {manager} />

### Option B: Group props into typed objects (if manager is not a store)
Group into 2-3 logically cohesive prop objects:
```typescript
type ModalState = { open: boolean; editingId: string | null; isSubmitting: boolean; isTesting: boolean; testStatus: ... | null; modalError: string | null }
type FormState = { form: Record<string, string>; formName: string; formTenants: string[]; showSecrets: Record<string, boolean> }
type ModalConfig = { activeProvider: ProviderSchema | null; tenantOptions: { value: string; label: string }[] }
```
This reduces from 14 individual bindings to 3 structured objects.

Choose Option A if the manager is already a reactive class. Choose Option B if props are managed individually in the parent.

### Update onSave and onTest
Keep these as callbacks (they trigger side effects), not as part of the manager object.

## How to Verify Completion
- The modal component has at most 3-4 props (not 14)
- Parent page passes props in a simplified form
- cd frontend && npm run build exits 0
- Integration modal works: open, fill form, test, save

## Definition of Done
- integration-modal.svelte refactored to <=4 top-level props
- Parent page updated to use simplified interface
- All modal functionality preserved
- Build and type-check pass

