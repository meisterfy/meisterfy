# React Migration — Phase 2 (Proof Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each top-level Task maps to one AIPIM task.

**Goal:** Port the ADR-001 "proof slice" — **login + integrations (with modal) + `[tenant]/settings/users`** — to `frontend-react/`, on the `claude/react-migration` branch, then **STOP at a calibration checkpoint** to measure token/effort/quality before committing to the remaining routes (Phase 3).

**Architecture:** The Svelte source under `frontend/` is the behavioral spec — **read each `.svelte`/`.svelte.ts` original before porting it**. Framework-agnostic API modules (`lib/api/*`) are copied nearly verbatim (like Phase 1's `client.ts`). Svelte runes state (`$state`/`$derived`/`$effect`, the `IntegrationManager` class) is reimplemented with React hooks (`useState`/`useMemo`/`useEffect`) + TanStack Query for data loading (replacing `+page.ts` client loaders). bits-ui components become shadcn-on-Base-UI primitives. paraglide `m['ns:key']()` becomes react-i18next `t('ns:key')`. SvelteKit `goto`/`resolve` becomes TanStack Router navigation.

**Tech Stack:** (Phase 0/1 base) Vite+bun, React 19+TS, TanStack Router/Query, Zustand, shadcn-on-Base-UI (`@base-ui/react`), Tailwind v4, react-i18next, Vitest+Testing Library+Playwright. **New in Phase 2:** `sonner` (toast), `@tanstack/react-table` (DataTable). MultiSelect and Drawer are built as thin local primitives (anti-bloat — see ADR 001).

**Authoritative context:** ADR `docs/adrs/001-migrate-frontend-from-svelte-to-react.md`, `CLAUDE.md`, and the Phase 0/1 plan + its completion notes in AIPIM (TASK-081..090). Operator decisions for this phase (2026-06-09): the heavy `$effect` route is **`[tenant]/settings/users`** (max calibration signal); the design-token reconciliation resolves **brand indigo wins** (TASK-091).

---

## Global conventions (apply to EVERY task)

- **Read the Svelte original first.** Each port task names its source file(s). The markup/logic there is the contract — do not invent behavior.
- **Filenames kebab-case**, single quotes, no semicolons (Prettier). Component identifiers PascalCase.
- **i18n:** `m['ns:key']()` / `m.key()` → `const { t } = useTranslation('<defaultNs>')` then `t('ns:key')` (the `ns:` prefix selects the namespace; our i18n nsSeparator is `:`). Interpolations `m.key({ x })` → `t('ns:key', { x })`.
- **Navigation:** `goto(resolve('/x'))` → `const navigate = useNavigate(); navigate({ to: '/x' })`. Guards/loaders throwing `redirect(...)` use TanStack Router's `redirect`.
- **Data loading:** each `+page.ts`/`+layout.ts` `load` becomes a TanStack Query `useQuery` (or a route `loader`) calling the ported `lib/api` function. Preserve the `withFallback` semantics (a failed fetch yields the fallback value, never crashes the page) via `useQuery`'s `placeholderData`/error handling or by `.catch(() => fallback)` in the `queryFn`.
- **State:** local `$state` → `useState`; `$derived`/`$derived.by` → `useMemo`; `$effect` → `useEffect`. A cohesive runes *class* (IntegrationManager) → a page-scoped custom hook returning `{ ...state, ...actions }`.
- **Toast:** `import { toast } from 'svelte-sonner'` → `import { toast } from 'sonner'` (same API surface: `toast.success(...)`).
- **Every code-changing step shows the code or names the exact source to mirror. TDD: write the failing test, see it fail, implement, see it pass, commit.** One AIPIM task at a time: `update_task_status(in-progress)` → implement → `bun run test`/`test:e2e` green → commit → `add_comment` (what/where) → `complete_task(notes)`.
- **Scope guard:** `frontend/` (Svelte) stays UNTOUCHED. All work in `frontend-react/`. Confirm `git status --short` shows only `frontend-react/` paths before each commit. `routeTree.gen.ts` stays gitignored.

---

## File Structure (Phase 2 deliverables, under `frontend-react/`)

```
src/
  lib/
    api/
      integrations.ts        # port of frontend/src/lib/api/integrations.ts (+ types)
      tenants.ts             # port of frontend/src/lib/api/tenants.ts (+ types)
      admin-users.ts         # port of frontend/src/lib/api/admin-users.ts (+ types)
      legal.ts               # PARTIAL: just setUserSystemRole (the slice's only legal dep)
    utils/
      loader.ts              # port of frontend/src/lib/utils/loader.ts (withFallback)
    query.ts                 # tiny helpers: query keys + a fallbackQuery wrapper
  components/
    ui/
      skeleton.tsx           # new primitive
      drawer.tsx             # new primitive (thin, Base UI Dialog-based side panel)
      multi-select.tsx       # new primitive (thin custom)
      confirm-dialog.tsx     # wrapper over ./dialog
      data-table.tsx         # generic TanStack React Table wrapper
      sonner.tsx             # <Toaster/> (shadcn sonner)
    provider-icon.tsx        # display: provider logo (svg/png/fallback)
    brand-icon.tsx           # display: tenant brand monogram
    section-title.tsx        # display
    seo.tsx                  # sets document.title/meta (no SvelteKit <svelte:head>)
  routes/
    login.tsx                # REPLACES the Phase-1 placeholder login route
    settings/
      integrations.tsx       # the integrations route (TanStack file route '/settings/integrations')
    $tenant/
      route.tsx              # layout route for '/$tenant' (tenant context + nav shell)
      settings/
        users.tsx            # the users route '/$tenant/settings/users'
  features/
    integrations/
      use-integration-manager.ts   # port of integrations.svelte.ts (runes class -> hook)
      integration-filters.tsx
      integration-section.tsx
      card-add.tsx
      card-connected.tsx
      integration-modal.tsx         # Dialog + MultiSelect + Select + ProviderIcon
    users/
      use-users-data.ts             # queries: active/inactive users + roles
      users-table.tsx
      invite-drawer.tsx
      edit-drawer.tsx
      reactivate-drawer.tsx
      user-helpers.ts               # avatarColor/initials/localeName/roleName (pure, unit-tested)
  layout/
    tenant-toolbar.tsx              # nav/toolbar for the tenant layout
e2e/
  login.spec.ts
  integrations.spec.ts
  users.spec.ts
```

> Source references for the porter (read before porting):
> - login: `frontend/src/routes/login/+page.svelte`
> - integrations: `frontend/src/routes/settings/integrations/{+page.svelte,+page.ts,integrations.svelte.ts}` and `components/{integration-modal,integration-filters,integration-section}.svelte`, `frontend/src/lib/components/ui/card/connection/{card-add,card-connected}.svelte`, `provider-icon.svelte`
> - users: `frontend/src/routes/[tenant]/settings/users/{+page.svelte,+page.ts}`, the tenant layout `frontend/src/routes/[tenant]/{+layout.svelte,+layout.ts}`, and `frontend/src/lib/components/ui/{drawer,dialog/confirm-dialog,data-table,multiselect}/*`

---

## SUB-PHASE 2A — Foundation (no routes yet)

### Task 1: Design-token reconciliation — brand indigo wins (fixes TASK-091)

**Files:** Modify `frontend-react/src/styles/app.css`. Test: `frontend-react/src/styles/tokens.test.ts`.

**Decision (operator, 2026-06-09):** the brand indigo `--color-primary` and slate `--color-border` must win over the shadcn-neutral values that `shadcn init` appended in its `@theme inline` block.

- [ ] **Step 1 — Read the two competing blocks.** In `src/styles/app.css`, locate the brand `@theme` block (defines `--color-primary: var(--primary-base)`, `--color-border: var(--border-color)`) and the later `@theme inline` block from shadcn (redefines `--color-primary: var(--primary)`, `--color-border: var(--border)`). The later block wins today — that is the bug.

- [ ] **Step 2 — Make brand win.** In the shadcn `@theme inline` block, repoint the shadcn CSS variables to the brand values so primitives consume indigo/slate: set `--primary: var(--primary-base)` and `--border: var(--border-color)` (and their `-foreground` companions if the brand defines them; otherwise leave shadcn's foreground). Do NOT delete shadcn's other tokens (background/foreground/muted/etc.) — only realign `primary` and `border` to the brand. Keep exactly one definition path so there is no ambiguity. Add a short comment explaining the reconciliation and citing TASK-091.

- [ ] **Step 3 — Write a guard test** `src/styles/tokens.test.ts` that imports nothing heavy but asserts the resolved utility intent. Since CSS variables can't be computed in jsdom, assert against the stylesheet text instead:
```ts
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('design tokens', () => {
  it('maps shadcn --primary/--border to the brand tokens (TASK-091)', () => {
    const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8')
    expect(css).toMatch(/--primary:\s*var\(--primary-base\)/)
    expect(css).toMatch(/--border:\s*var\(--border-color\)/)
  })
})
```

- [ ] **Step 4 — Run** `bun run test src/styles/tokens.test.ts` → PASS. Then `bun run build` → clean.

- [ ] **Step 5 — Commit**
```bash
git add -A && git commit -m "fix(react): brand indigo owns --color-primary/--color-border (TASK-091)"
```

### Task 2: Loader util + Query helpers

**Files:** Create `src/lib/utils/loader.ts`, `src/lib/query.ts`, tests `src/lib/utils/loader.test.ts`.
**Source:** `frontend/src/lib/utils/loader.ts` (read it; `withFallback(promise, fallback)` resolves the promise but returns `fallback` on rejection).

- [ ] **Step 1 — Port `withFallback` verbatim** to `src/lib/utils/loader.ts` (it is framework-agnostic). If the Svelte version returns a promise that never rejects (resolving to fallback on error), mirror that exactly.

- [ ] **Step 2 — Add `src/lib/query.ts`** with a tiny helper that adapts the fallback semantics to TanStack Query and a query-key factory used across the slice:
```ts
export const qk = {
  integrations: ['integrations'] as const,
  tenants: ['tenants'] as const,
  tenant: (id: string) => ['tenant', id] as const,
  tenantUsers: (tenant: string, active: boolean) => ['tenant-users', tenant, active] as const,
  roles: ['roles'] as const
}

// Run a queryFn but resolve to `fallback` if it throws — mirrors the Svelte withFallback loaders.
export async function fallbackQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}
```

- [ ] **Step 3 — Test** `loader.test.ts`: a resolving promise returns its value; a rejecting promise returns the fallback. Run `bun run test src/lib/utils/loader.test.ts` → PASS.

- [ ] **Step 4 — Commit** `feat(react): loader fallback util + query key/helper`

### Task 3: Port API module — integrations

**Files:** Create `src/lib/api/integrations.ts`, test `src/lib/api/integrations.test.ts`.
**Source:** `frontend/src/lib/api/integrations.ts` — copy VERBATIM (types `FieldSchema`, `ProviderSchema`, `Integration`, `IntegrationsPageData`, `CreateIntegrationBody`, status/provider types, and functions `getIntegrations`, `getIntegration`, `listProviders`, `createIntegration`, `updateIntegration`, `deleteIntegration`, `testIntegration`, `setIntegrationTenants`). The import of the API client must become `from './client'` (Phase 1 client is framework-agnostic and identical).

- [ ] **Step 1 — Copy verbatim**, fixing only the client import path (`$lib/api/client` → `./client`). Run `diff -w` against the source to confirm only the import changed.
- [ ] **Step 2 — One representative test** in `integrations.test.ts`: stub `fetch`, call `getIntegrations(fetchFn)`, assert it requests the right path and returns the parsed `data`. (Use the same `apiFetchData` pattern as Phase 1's client test — these functions go through `apiFetch`/`apiFetchData`.) Run → PASS.
- [ ] **Step 3 — Commit** `feat(react): port integrations api module`

### Task 4: Port API module — tenants

**Files:** Create `src/lib/api/tenants.ts`, test `src/lib/api/tenants.test.ts`.
**Source:** `frontend/src/lib/api/tenants.ts` (types `AdsMonitoringConfig`, `ReportPrompts`, `TenantConnector`, `Tenant`; functions `getTenants`, `getTenant`, `createTenant`, `updateTenant`, `deleteTenant`, `getGoogleAdsStatus`).

- [ ] **Step 1 — Copy verbatim** (fix client import path only); `diff -w` to confirm.
- [ ] **Step 2 — One test:** `getTenant(id, fetchFn)` requests `/.../${id}` and returns parsed data. Run → PASS.
- [ ] **Step 3 — Commit** `feat(react): port tenants api module`

### Task 5: Port API module — admin-users (+ partial legal)

**Files:** Create `src/lib/api/admin-users.ts`, `src/lib/api/legal.ts` (only `setUserSystemRole`), test `src/lib/api/admin-users.test.ts`.
**Source:** `frontend/src/lib/api/admin-users.ts` (types `AdminUser`, `AdminRole`, `AdminPermission`; functions `listTenantUsers`, `reactivateTenantUser`, `createTenantUser`, `updateTenantUser`, `deactivateTenantUser`, `assignUserRole`, `listRoles`, `createRole`, `updateRole`, `setRolePermissions`, `deleteRole`, `listPermissions`). And `frontend/src/lib/api/legal.ts` — port ONLY `setUserSystemRole` (the users route's single legal dependency); do NOT port the rest of legal.ts (YAGNI — it belongs to the legal route, a later phase).

- [ ] **Step 1 — Copy admin-users.ts verbatim** (fix client import path); `diff -w` to confirm.
- [ ] **Step 2 — Create `legal.ts`** containing only `setUserSystemRole` (and any type it needs), copied from the Svelte legal module's matching export.
- [ ] **Step 3 — Tests:** `listTenantUsers(tenant, true, fetchFn)` hits the active-users path and returns data; `createTenantUser(...)` POSTs the expected body. Run → PASS.
- [ ] **Step 4 — Commit** `feat(react): port admin-users api + setUserSystemRole`

### Task 6: Toast — sonner + Toaster in the app shell

**Files:** `bun add sonner`. Create `src/components/ui/sonner.tsx` (shadcn `<Toaster/>`). Modify `src/app.tsx` to mount `<Toaster/>`. Test `src/components/ui/sonner.test.tsx`.

- [ ] **Step 1 — Install** `cd frontend-react && bun add sonner`.
- [ ] **Step 2 — Add `sonner.tsx`** (the shadcn sonner wrapper: a `<Toaster/>` that reads theme; keep it minimal — no theme provider yet, default theme is fine). Mount `<Toaster richColors />` inside `app.tsx` alongside the providers (after `<RouterProvider/>`, still inside `<QueryClientProvider>`).
- [ ] **Step 3 — Test:** render `<Toaster/>`, call `toast.success('hi')`, assert the message appears (`await screen.findByText('hi')`). Run → PASS.
- [ ] **Step 4 — Commit** `feat(react): sonner toaster in app shell`

### Task 7: Primitive — Skeleton

**Files:** `src/components/ui/skeleton.tsx`, test `skeleton.test.tsx`.
**Source:** `frontend/src/lib/components/ui/skeleton.svelte` (a `div` with pulse classes; trivial). Prefer `bunx shadcn@latest add skeleton` if it produces a Base UI-compatible file; otherwise hand-write the one-liner.

- [ ] **Step 1 — Create** `Skeleton` = a `div` accepting `className`, merged via `cn()`, with the animate-pulse + rounded + muted-bg classes matching the Svelte source.
- [ ] **Step 2 — Test:** renders with role-less div, applies a passed `className`. Run → PASS.
- [ ] **Step 3 — Commit** `feat(react): skeleton primitive`

### Task 8: Primitive — Drawer (side panel)

**Files:** `src/components/ui/drawer.tsx`, test `drawer.test.tsx`.
**Source:** `frontend/src/lib/components/ui/drawer/drawer.svelte` — read it to match the API the users page expects (`<Drawer bind:open title>...children...</Drawer>` with a header/close + slide-in panel). Anti-bloat: build a THIN drawer on `@base-ui/react` Dialog (already a dependency) styled as a right-side sheet — do NOT add `vaul` unless the Base UI version proves inadequate (note in the AIPIM comment if you must).

- [ ] **Step 1 — Implement** a controlled `Drawer` ({ open, onOpenChange, title, children }) using Base UI Dialog parts: backdrop + a fixed right-edge panel (`inset-y-0 right-0 w-full max-w-md`) with the SINGLE-mechanism positioning rule (no double-translate; the panel is edge-anchored, not center-translated). Include a header with the title and a close button. Reuse the dialog open/close data-attribute animation approach from Phase 1's `dialog.tsx`.
- [ ] **Step 2 — Test:** render `<Drawer open title='X'>body</Drawer>`; assert title and body visible. Run → PASS.
- [ ] **Step 3 — Commit** `feat(react): drawer side-panel primitive (base-ui)`

### Task 9: Primitive — MultiSelect (thin custom)

**Files:** `src/components/ui/multi-select.tsx`, test `multi-select.test.tsx`.
**Source:** `frontend/src/lib/components/ui/multiselect/multi-select.svelte` — read it to match the contract the integration modal uses (a control bound to `string[]` with `{ value: string; label: string }[]` options; toggles selection; shows chips/checks). Anti-bloat: build a small custom component (a Popover/list of checkboxes) on existing primitives — do NOT pull `cmdk` or a combobox lib.

- [ ] **Step 1 — Implement** `MultiSelect` ({ options: {value,label}[], value: string[], onChange: (next: string[]) => void, placeholder? }) rendering a trigger button (showing count/labels) and a panel of checkbox rows; clicking toggles membership in `value` via `onChange`. Keyboard/focus basics; reuse `Checkbox` (Phase 1).
- [ ] **Step 2 — Test:** render with two options and `value=[]`; click an option → `onChange` called with `['that-value']`. Use `@testing-library/user-event`. Run → PASS.
- [ ] **Step 3 — Commit** `feat(react): multi-select primitive (thin)`

### Task 10: Wrapper — ConfirmDialog

**Files:** `src/components/ui/confirm-dialog.tsx`, test `confirm-dialog.test.tsx`.
**Source:** `frontend/src/lib/components/ui/dialog/confirm-dialog.svelte` — props `{ open, title, description, confirmLabel, isLoading, onConfirm }` (Svelte used `bind:open` + `onconfirm`; React: `open`, `onOpenChange`, `onConfirm`).

- [ ] **Step 1 — Implement** on top of Phase 1's `Dialog`: title, description, a Cancel button (closes) and a Confirm button (calls `onConfirm`, shows a spinner/disabled when `isLoading`). Include a `DialogTitle` for a11y.
- [ ] **Step 2 — Test:** render open; click Confirm → `onConfirm` called. When `isLoading`, the confirm button is disabled. Run → PASS.
- [ ] **Step 3 — Commit** `feat(react): confirm-dialog wrapper`

### Task 11: Primitive — DataTable (TanStack React Table)

**Files:** `bun add @tanstack/react-table`. Create `src/components/ui/data-table.tsx`, test `data-table.test.tsx`.
**Source:** `frontend/src/lib/components/ui/data-table/data-table.svelte` — read it to match the consumed API. The users page imports `ColumnDef` from `@tanstack/table-core` and a `renderSnippet` helper; in React, columns use `@tanstack/react-table`'s `ColumnDef` with `cell`/`header` render fns (no `renderSnippet` needed — JSX directly).

- [ ] **Step 1 — Install** `@tanstack/react-table`.
- [ ] **Step 2 — Implement** a generic `DataTable<TData>({ columns, data })` using `useReactTable` + `getCoreRowModel`, rendering a semantic `<table>` with header groups and rows (Card-styled, matching the Svelte table's look). Keep it minimal — only core row model (no sorting/pagination yet; YAGNI until a route needs it).
- [ ] **Step 3 — Test:** render with 2 columns + 2 rows of fixture data; assert cell text appears. Run → PASS.
- [ ] **Step 4 — Commit** `feat(react): data-table primitive (tanstack react-table)`

### Task 12: Display components — ProviderIcon, BrandIcon, SectionTitle, Seo

**Files:** `src/components/provider-icon.tsx`, `src/components/brand-icon.tsx`, `src/components/section-title.tsx`, `src/components/seo.tsx`; one test file `src/components/display.test.tsx`.
**Sources:** the matching `.svelte` files under `frontend/src/lib/components/ui/` (`provider-icon.svelte`, `brand-icon.svelte`, `title/section-title.svelte`) and `frontend/src/lib/components/seo.svelte`.

- [ ] **Step 1 — ProviderIcon** ({ provider, logoSvg?, logoPng? }) — render inline SVG if `logoSvg`, else `<img>` the PNG, else a fallback monogram/icon. Match the Svelte precedence.
- [ ] **Step 2 — BrandIcon** ({ name }) — a colored monogram from the name's initials (mirror the Svelte color/initials logic; if it shares logic with users' avatar, keep it local here and let `user-helpers.ts` have its own copy — small duplication over a shared util is fine here).
- [ ] **Step 3 — SectionTitle** ({ children } or { title, description }) — match the Svelte markup.
- [ ] **Step 4 — Seo** ({ title, description? }) — a component that sets `document.title` (and optionally a meta description) via `useEffect`. No SvelteKit `<svelte:head>` equivalent needed for an SPA.
- [ ] **Step 5 — Test** `display.test.tsx`: ProviderIcon renders an `<img>` when only `logoPng` given; Seo sets `document.title`. Run → PASS.
- [ ] **Step 6 — Commit** `feat(react): provider-icon/brand-icon/section-title/seo display components`

---

## SUB-PHASE 2B — Login route

### Task 13: Login route

**Files:** Replace `src/routes/login.tsx` (currently a Phase-1 placeholder). Test `src/routes/login.test.tsx`, `e2e/login.spec.ts`.
**Source:** `frontend/src/routes/login/+page.svelte` (read it). No `+page.ts` loader.

Behavior to mirror: controlled `email`/`password`/`error`/`loading` state; `submit` POSTs `/auth/login` with `credentials:'include'` (raw `fetch`, NOT `apiFetch` — this is pre-auth); on `!res.ok` set `error` (`data.error ?? t('auth:login_failed')`); on success `auth.setToken` + client `setToken` + `auth.setUser({...data.user, tenant_id, permissions})`, then navigate to `/tenants/new` if `data.needs_tenant` else `/`. Network error → `error = t('auth:network_error')`. UI uses `Input`/`Label`/`Button`/`Alert` (Phase 1) + the indigo background flourishes from the source.

- [ ] **Step 1 — Write the failing component test** `login.test.tsx`: render the login route's component (export the component or render via a memory router), stub `fetch` to resolve `{ ok:true, json: { access_token:'T', user:{...}, needs_tenant:false } }`, type email+password, submit, assert `useAuth.getState().isAuthenticated()` becomes true. (Mock `useNavigate` or assert via the auth store.) Run → FAIL.
- [ ] **Step 2 — Implement** the route component (file route `'/login'`) mirroring the source; map paraglide → `t`, `goto/resolve` → `useNavigate`. Keep the markup/classes faithful (it consumes `--color-primary` = brand indigo now).
- [ ] **Step 3 — Run** `login.test.tsx` → PASS. Full `bun run test` green.
- [ ] **Step 4 — e2e** `login.spec.ts`: with the backend down, visiting `/login` renders the form (email/password/submit visible) and submitting shows the network-error alert (deterministic without a backend). Run `bun run test:e2e` → PASS.
- [ ] **Step 5 — Commit** `feat(react): login route`

---

## SUB-PHASE 2C — Integrations slice

### Task 14: IntegrationManager → `useIntegrationManager` hook

**Files:** `src/features/integrations/use-integration-manager.ts`, test `use-integration-manager.test.ts`.
**Source:** `frontend/src/routes/settings/integrations/integrations.svelte.ts` (228 lines — READ IT FULLY). Port the runes class to a page-scoped hook returning state + actions with the SAME names: state `integrations, providers, tenantOptions, isLoading, searchQuery, selectedCategory, showModal, editingId, activeProvider, form, formName, formTenants, isSubmitting, isTesting, showDelete, deletingId, isDeleting`; derived `filteredProviders, justConnected, connectedMessage` (`justConnected` reads the router search param `connected === '1'`); actions `init(data), clearFilters, openCreate, openEdit, confirmDelete, handleSave, handleTest, handleConnect, handleDelete`, plus the `GROUP_ORDER`/`GROUP_LABELS` constants and `providerForIntegration`. Use `useState` for state, `useMemo` for derived, `useNavigate`/route search for `justConnected`, and the ported `lib/api/integrations` functions for the async actions. Keep method semantics identical (e.g. `handleSave` validates `formName`/`activeProvider`, calls create or update, refreshes).

- [ ] **Step 1 — Write failing tests** for the pure/derived bits first: `clearFilters` resets `searchQuery`/`selectedCategory`; `filteredProviders` filters by query + category; `openEdit` populates `form`/`formName`/`formTenants`/`editingId`/`activeProvider`/`showModal`. Run → FAIL.
- [ ] **Step 2 — Implement** the hook mirroring the class. For async actions, inject the api functions (or import them) so they can be stubbed.
- [ ] **Step 3 — Run** tests → PASS. (Async action tests: stub the api module to assert `handleSave` calls create vs update based on `editingId`.)
- [ ] **Step 4 — Commit** `feat(react): integration manager hook (port runes class)`

### Task 15: Integrations sub-components (filters, section, cards)

**Files:** `src/features/integrations/{integration-filters,integration-section,card-add,card-connected}.tsx`; test `integrations-components.test.tsx`.
**Sources:** the matching `.svelte` files under `frontend/src/routes/settings/integrations/components/` and `frontend/src/lib/components/ui/card/connection/`.

- [ ] **Step 1 — IntegrationFilters** ({ searchQuery, onSearchChange, selectedCategory, onCategoryChange, categories, categoryLabels, onClear }) — search Input + category Select + clear button.
- [ ] **Step 2 — IntegrationSection** ({ title, description, children }) — section wrapper with header + responsive grid.
- [ ] **Step 3 — CardAdd** ({ provider, onClick }) and **CardConnected** ({ integration, provider, tenantOptions, onEdit, onDelete, onConnect }) — mirror the Svelte card markup (ProviderIcon + labels + action buttons).
- [ ] **Step 4 — Test:** CardAdd renders the provider name and fires `onClick`; IntegrationFilters fires `onClear`. Run → PASS.
- [ ] **Step 5 — Commit** `feat(react): integrations filters/section/cards`

### Task 16: IntegrationModal

**Files:** `src/features/integrations/integration-modal.tsx`, test `integration-modal.test.tsx`.
**Source:** `frontend/src/routes/settings/integrations/components/integration-modal.svelte` (182 lines — READ IT). It uses bits-ui `Dialog`, `MultiSelect`, `Select`, `ProviderIcon`, and a Svelte `{#snippet fieldGroup(...)}`. In React: use Phase-1 `Dialog`, the new `MultiSelect`/`Select`/`ProviderIcon`, and turn the `fieldGroup` snippet into a local `FieldGroup` sub-component. Props mirror the source: `{ manager, onSave, onTest }` where `manager` is the hook's return value (so the modal reads `manager.showModal`, `manager.activeProvider`, `manager.form`, `manager.formName`, `manager.formTenants`, etc., and calls setters from the hook).

- [ ] **Step 1 — Implement** the modal: header (ProviderIcon + title `Add/Edit ${display_name}` + description), a `FieldGroup` for credential fields and one for config fields (each field renders an Input/Select bound to `manager.form[field.key]`), the name Input (`manager.formName`), the tenants MultiSelect (`manager.formTenants` ↔ `manager.tenantOptions`), and footer buttons: Test (calls `onTest`, with `FlaskConical` icon) and Save (calls `onSave`, disabled while `manager.isSubmitting`). Centering uses the Phase-1 Dialog's single-mechanism rule.
- [ ] **Step 2 — Test:** with a manager fixture (`showModal:true`, an `activeProvider` with two config fields), render the modal, assert the title and both fields show; clicking Save calls `onSave`. Run → PASS.
- [ ] **Step 3 — Commit** `feat(react): integration modal (dialog + multiselect + select)`

### Task 17: Integrations route (assemble + data)

**Files:** `src/routes/settings/integrations.tsx`, test `e2e/integrations.spec.ts`.
**Source:** `frontend/src/routes/settings/integrations/+page.svelte` (the page) + `+page.ts` (loader). The loader fetched `getIntegrations` + `getTenants` with `withFallback`.

- [ ] **Step 1 — Implement** the file route `'/settings/integrations'`. Load data with two `useQuery` calls (`qk.integrations`→`fallbackQuery(() => getIntegrations(), {integrations:[],providers:[]})`; `qk.tenants`→`fallbackQuery(() => getTenants(), [])`). Instantiate the hook (`const manager = useIntegrationManager()`), `useEffect(() => manager.init({ data, tenants }), [data, tenants])`, and a second `useEffect` to `toast.success(manager.connectedMessage)` when `manager.justConnected`. Render the skeletons while loading, the connected `IntegrationSection` + cards, the browse section with `IntegrationFilters` + `CardAdd` grid (and the empty/clear states), then `<IntegrationModal manager onSave={manager.handleSave} onTest={manager.handleTest} />` and `<ConfirmDialog open={manager.showDelete} ... onConfirm={manager.handleDelete} />`. Mirror the source's conditional blocks and i18n keys.
- [ ] **Step 2 — Guard:** this route is under the authenticated area — add the same `beforeLoad` auth guard pattern used on `/` in Phase 1 (redirect to `/login` if not authenticated). (Confirm against how the Svelte settings layout gates access.)
- [ ] **Step 3 — e2e** `integrations.spec.ts`: with the backend down, the loaders fall back to empty and the route renders the browse/empty state without crashing (assert a stable testid on the page container). Authentated-state simulation: seed `sessionStorage` with a valid `meisterfy_session` before `page.goto` so the guard passes (mirror the auth-guard spec technique). Run `bun run test:e2e` → PASS.
- [ ] **Step 4 — Commit** `feat(react): integrations route`

---

## SUB-PHASE 2D — Tenant layout + Users route

### Task 18: Tenant layout route (`/$tenant`)

**Files:** `src/routes/$tenant/route.tsx` (layout route), `src/layout/tenant-toolbar.tsx`, test `e2e` covered later.
**Sources:** `frontend/src/routes/[tenant]/+layout.svelte` (151 lines) + `+layout.ts` (41 lines). The layout loads the tenant (`getTenant(params.tenant)`; 404 if missing), exposes `client` (brand summary) and a lazy `clients` list for the switcher, and renders a Toolbar with a client Dropdown, desktop nav (Social/Ads/Alerts/Settings), a ProfileLink, a mobile menu, and a Footer.

- [ ] **Step 1 — Create the layout file route** `'/$tenant'` with a `loader`/`useQuery` that calls `getTenant(params.tenant)`; on missing tenant, throw a `notFound()`/redirect (mirror the Svelte `error(404)`). Provide the tenant context to children via the route context or a small Zustand/`useParams`-based accessor (simplest: children read `useParams({ from: '/$tenant' })` + a `useQuery(qk.tenant(id))`).
- [ ] **Step 2 — Implement `tenant-toolbar.tsx`** mirroring the Svelte toolbar: brand dropdown (client switcher — lazy `getTenants` list), nav items (use `<Link>` with the `$tenant` param), profile link, mobile menu toggle. Keep nav items minimal to what the proof slice needs (the Settings → Users path must work); other nav links may point at placeholder routes or be visually present but inert — note any inert links in the AIPIM comment (do NOT build the other routes — that's Phase 3).
- [ ] **Step 3 — Render** `<Outlet/>` inside the toolbar shell + Footer. Build clean; `bun run build` green (routeTree regenerates the `$tenant` tree).
- [ ] **Step 4 — Commit** `feat(react): tenant layout route + toolbar`

### Task 19: Users data hook + helpers

**Files:** `src/features/users/use-users-data.ts`, `src/features/users/user-helpers.ts`, tests `user-helpers.test.ts`, `use-users-data.test.ts`.
**Source:** `frontend/src/routes/[tenant]/settings/users/+page.ts` (loader: `listTenantUsers(tenant, true)`, `listTenantUsers(tenant, false)`, `listRoles`) and the helper functions in `+page.svelte` (`avatarColor`, `initials`, `localeName`, `roleName`).

- [ ] **Step 1 — `user-helpers.ts`:** port the pure helpers `avatarColor(id)`, `initials(name)`, `localeName(locale)`, `roleName(role)` verbatim (they're pure functions). Test them with fixtures → PASS first (TDD: write tests, then port).
- [ ] **Step 2 — `use-users-data.ts`:** a hook ({ tenant }) running three `useQuery`s (active users, inactive users, roles) via `fallbackQuery(..., [])`, returning `{ users, inactiveUsers, roles, isLoading }`. Test with a `QueryClientProvider` wrapper + stubbed api → returns the fixtures.
- [ ] **Step 3 — Commit** `feat(react): users data hook + pure helpers`

### Task 20: UsersTable

**Files:** `src/features/users/users-table.tsx`, test `users-table.test.tsx`.
**Source:** the table/columns portion of `frontend/src/routes/[tenant]/settings/users/+page.svelte` (the `ColumnDef`s, avatar cell, role cell, action buttons — Edit/Deactivate/Reactivate gated by permissions) + `SettingsSkeleton`/`SectionTitle`.

- [ ] **Step 1 — Implement** `UsersTable` ({ users, roles, tab, permissions: { canUpdate, canDelete, ... }, onEdit, onDeactivate, onReactivate }) building `ColumnDef[]` (avatar+name+email, role via `roleName`, status, actions). Use the Phase-2 `DataTable`. Action buttons render conditionally on the permission flags (the Svelte `$derived` perms become props computed from `useAuth`).
- [ ] **Step 2 — Test:** render with two user fixtures + `canUpdate:true`; assert names render and the Edit action fires `onEdit(user)`. With `canUpdate:false`, Edit is absent. Run → PASS.
- [ ] **Step 3 — Commit** `feat(react): users table`

### Task 21: User drawers (invite / edit / reactivate)

**Files:** `src/features/users/{invite-drawer,edit-drawer,reactivate-drawer}.tsx`, test `user-drawers.test.tsx`.
**Source:** the drawer/forms portion of the users `+page.svelte` (`handleInvite` → `createTenantUser`; edit → `updateTenantUser`; reactivate → `reactivateTenantUser`; role select + locale select; invite form fields name/email/password/role/locale; toasts on success; inline error on failure).

- [ ] **Step 1 — InviteDrawer** ({ open, onOpenChange, roles, tenant, onInvited }) — form with name/email/password, role `Select`, locale `Select`; submit validates non-empty, calls `createTenantUser({ name, email, password, role_id, locale })`, on success `toast.success(t('settings:users_toast_invited'))` + `onInvited()` (refetch) + close + reset; on failure set inline error. Use the Phase-2 `Drawer`.
- [ ] **Step 2 — EditDrawer** ({ open, onOpenChange, user, roles, tenant, onSaved }) — edit name/role (+ system role if platform admin via `setUserSystemRole`); calls `updateTenantUser`/`assignUserRole` as the source does; toast + refetch + close.
- [ ] **Step 3 — ReactivateDrawer** ({ open, onOpenChange, user, roles, tenant, onReactivated }) — pick a role, call `reactivateTenantUser(userId, tenant, roleId)`; toast + refetch + close.
- [ ] **Step 4 — Test:** open InviteDrawer, fill fields, submit with a stubbed `createTenantUser` resolving ok → assert it was called with the right body and `onInvited` fired. Run → PASS.
- [ ] **Step 5 — Commit** `feat(react): user invite/edit/reactivate drawers`

### Task 22: Users route (assemble + guards + confirm)

**Files:** `src/routes/$tenant/settings/users.tsx`, test (e2e in Task 23).
**Source:** the top-level wiring of the users `+page.svelte` (tabs active/inactive, the deactivate `ConfirmDialog`, permission gating via `auth.user.permissions`, mounting the table + drawers).

- [ ] **Step 1 — Implement** the file route `'/$tenant/settings/users'`: read `tenant` from params; `const { users, inactiveUsers, roles, isLoading } = useUsersData({ tenant })`; compute permission flags from `useAuth`; manage `activeTab`, drawer open states, and `deactivateTarget`. Render `SectionTitle`, the tab switcher, `<UsersTable .../>` (active or inactive per tab), the three drawers, and a `<ConfirmDialog>` for deactivation (`onConfirm` → `deactivateTenantUser` → toast + refetch). Show the settings skeleton while `isLoading`.
- [ ] **Step 2 — Guard:** add the auth guard (`beforeLoad` redirect to `/login` if unauthenticated), consistent with the other authenticated routes.
- [ ] **Step 3 — Build** green; full `bun run test` green.
- [ ] **Step 4 — Commit** `feat(react): users route (tabs + table + drawers + confirm)`

### Task 23: Users route e2e

**Files:** `e2e/users.spec.ts`.

- [ ] **Step 1 — Spec:** seed a valid `meisterfy_session` (with permissions incl. `create:user`, `update:user`) in `sessionStorage` so the guard passes and actions show; backend down → users queries fall back to empty. `page.goto('/<tenant>/settings/users')`; assert the page container + the "invite" button render; open the invite drawer and assert its fields are visible (deterministic without a backend). Run `bun run test:e2e` → PASS.
- [ ] **Step 2 — Commit** `test(react): users route e2e`

---

## SUB-PHASE 2E — Regression net + calibration checkpoint

### Task 24: Port the relevant Playwright regression flows

**Files:** confirm `e2e/{login,integrations,users}.spec.ts` cover the behaviors the Svelte suite asserts for these three areas.
**Source:** the existing 23 Playwright flows under `frontend/` (per ADR 001, they are the behavioral spec). Identify the flows touching login / integrations / users and ensure the React specs assert equivalent user-visible behavior (adapting selectors to the React DOM). Do NOT port flows for routes not in this slice.

- [ ] **Step 1 — Map** which Svelte e2e flows cover login/integrations/users; list any behavior our three specs don't yet assert.
- [ ] **Step 2 — Strengthen** the three React specs to cover those behaviors that are testable without a live backend (or document which require the backend and are deferred to a full-stack e2e run).
- [ ] **Step 3 — Run** the full `bun run test:e2e` green. Commit `test(react): regression flows for proof slice`.

### Task 25: Calibration checkpoint (STOP)

**Files:** `docs/superpowers/notes/2026-06-09-phase-2-calibration.md` (a short report). Also `log_decision`/AIPIM comment.

- [ ] **Step 1 — Measure** per-route token/effort/quality (subagent token totals, number of review cycles, defects caught) for login vs integrations vs users. Record what was cheap, what was costly (the runes-class port, the tenant layout, the 692-line users page), and any new primitives that proved harder than expected (Drawer/MultiSelect/DataTable).
- [ ] **Step 2 — Write the report** with a recommendation: proceed to Phase 3 (remaining routes in simple→hard batches), and any plan/process adjustments the proof slice revealed.
- [ ] **Step 3 — STOP.** Do NOT start Phase 3 routes. This is a human checkpoint — present the calibration report and await the operator's go/no-go and batching decision.
- [ ] **Step 4 — Commit** `docs: phase 2 proof-slice calibration report`

---

## Definition of Done (Phase 2)

- The three proof-slice routes render and behave faithfully to their Svelte originals: `/login`, `/settings/integrations` (with the integration modal + confirm-delete), `/$tenant/settings/users` (tabs, table, invite/edit/reactivate drawers, deactivate confirm).
- All new foundation pieces exist and are tested: token reconciliation (brand indigo), API modules (integrations/tenants/admin-users/legal-partial), primitives (skeleton/drawer/multi-select/confirm-dialog/data-table/sonner), display components, the integration-manager hook, the tenant layout.
- `bun run test` (Vitest) and `bun run test:e2e` (Playwright) both green; `bun run build` clean. `frontend/` untouched.
- A calibration report exists and the phase **stops** for the operator's Phase-3 decision.

## Self-review notes

- **Spec coverage:** login (T13), integrations+modal (T14–T17), users+tenant-layout (T18–T23) — the exact ADR-001 proof slice. Foundation (T1–T12) supplies every primitive/API/util those routes import. Regression+calibration (T24–T25) is the ADR's calibration stop.
- **Decisions encoded:** heavy route = `[tenant]/settings/users` (operator); brand indigo wins TASK-091 (operator, T1).
- **Anti-bloat:** Drawer/MultiSelect built thin on existing deps; only `sonner` + `@tanstack/react-table` added. legal.ts ported partially (only `setUserSystemRole`). No Phase-3 routes pre-built; inert tenant-nav links flagged, not implemented.
- **Known risks to watch at execution:** the `IntegrationManager`→hook port (228 lines of stateful logic + URL-derived state) is the trickiest unit; the tenant layout pulls in nav/dropdown/footer that may tempt scope creep — keep them minimal; the users page is large — its decomposition (helpers/table/drawers/route) must keep each file focused.
```
