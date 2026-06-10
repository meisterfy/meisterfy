# React Migration — Phase 3 (Full Parity + Cutover) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (one Sonnet implementer per task, controller curates the prompt from the Svelte source, controller spec-checks verbatim/thin units by reading and reserves the full two-stage review for the `.svelte.ts`/runes-class hook ports). This plan is the source of truth for ordering and per-task scope. Each top-level task maps to one AIPIM task (`Phase 3 [batch][n]: …`).

**Goal:** bring `frontend-react/` to **1:1 parity** with the Svelte `frontend/`, then perform the **single cutover** (ADR-001) that makes React the deployed SPA and retires Svelte. Phase 2 (proof slice) is DONE; this plan covers everything that remains.

**Read first:** the Phase-2 plan `docs/superpowers/plans/2026-06-09-react-migration-phase-2-proof-slice.md` and its **Global conventions** section — they apply verbatim here (i18n `m['ns:key']()`→`t('ns:key')` with bare keys when the ns is bound; `goto/resolve`→`useNavigate`; `+page.ts` loader→`useQuery`+`fallbackQuery`; runes `$state/$derived/$effect`→`useState/useMemo/useEffect`; a runes *class*→a page-scoped hook; bits-ui→shadcn-on-`@base-ui/react`; `svelte-sonner`→`sonner`; files kebab-case, single quotes, no semicolons; `frontend/` stays UNTOUCHED; `routeTree.gen.ts` gitignored). Also read the **Phase-2 calibration report** `docs/superpowers/notes/2026-06-09-phase-2-calibration.md` for cost/quality lessons.

**Calibration carry-overs (apply throughout):**
- Run `tsc -b` (`bun run build`) yourself after any test-infra/config edit — vitest-green ≠ tsc-green; subagents misreport build state (memory `[[verify-build-after-config-edits]]`).
- jsdom `@base-ui` stubs are already in `src/test-setup.ts` (scrollTo/scrollIntoView/pointer-capture) + `testTimeout: 15000` — interaction tests inherit them.
- Decompose any page >~400 lines into helpers/hook/sub-components/route/e2e (the users-slice tactic).
- `lib/api` ports are byte-identical/near-free — batch them.
- The `.svelte.ts` runes-class→hook ports are the cost driver (~100–130k tokens each) — apply the **two-stage review** (spec reviewer subagent → fix subagent).

**Tech stack:** unchanged from Phase 0–2 (Vite+bun, React 19+TS, TanStack Router/Query, Zustand, shadcn-on-`@base-ui/react`, Tailwind v4, react-i18next, Vitest+Testing Library+Playwright). No new runtime deps expected beyond what a specific route forces (justify any in the AIPIM comment, per ADR-001 anti-bloat).

---

## Inventory & dependency map (Svelte source → React target)

**Routes remaining (line counts of the Svelte `+page.svelte`):** root `/` (160), `/setup` (161), `/profile` (280), `/tenants/new` (96), `/settings` layout (57) + `/settings/legal` (307), `/[tenant]/settings` layout (93) + index (3, redirect), `/[tenant]/settings/general` (232), `/audit` (299), `/roles` (583), `/mcp` (421), `/social` (293), `/google-ads` (526), `/[tenant]/social` layout (38) + page (69) + `/drafts` (324) + `/[post_id]` (533), `/[tenant]/alerts` (179), `/[tenant]/ads/google` (221) + `/[slug]` (262) + `/live/[campaign_id]` (145). Done in Phase 2: `/login`, `/settings/integrations`, `/[tenant]/settings/users`, `/[tenant]` layout.

**Route → loader API dependency (from each `+page.ts`):**
`/` & `/[tenant]` layout → tenants ✓ · `/settings/legal` → legal · `/settings/audit` → audit-log · `/settings/general` → (none/tenants) · `/settings/google-ads` → ai + tenants · `/settings/mcp` → mcp-keys · `/settings/roles` → admin-users ✓ · `/settings/social` → connector-resources · `/social` & `/social/[post_id]` → posts · `/social/drafts` → posts + connector-resources · `/alerts` → pending-adjustments · `/ads/google` (all three) → campaigns.

**`lib/api` remaining (line counts):** ai (87), ai-reports (41), audit-log (46), campaigns (307), connector-resources (44), mcp-keys (32), media (25), pending-adjustments (29), posts (85), social-accounts (43), users (19); **legal.ts** currently PARTIAL in React (only `setUserSystemRole`) — the Svelte legal.ts exports `LegalBlock`/`LegalVersion` types + the legal-version fns that the `/settings/legal` route needs.

**State classes (`.svelte.ts`) remaining:** `lib/runes/campaign-actions.svelte.ts` (61) and `lib/stores/campaign-chat.svelte.ts` (135) — used by `lib/components/chat/floating-chat.svelte`, `routes/[tenant]/ads/google/columns.ts`, and `…/ads/google/live/[campaign_id]/{+page.svelte,components/header.svelte}`. `lib/stores/theme.svelte.ts` (7, just `THEME_OPTIONS`) → a theme store + `ThemeToggle`.

**Cross-cutting cleanups (fold into the relevant route tasks, do NOT leave as orphan placeholders):** the Phase-2 tenant toolbar's nav/dropdown/profile links are inert plain `<a>` — upgrade each to a typed TanStack `<Link>` with active-state as its target route lands (Social→C3, Ads/Alerts→C6/C7, tenant Settings→B7, Create Client→B1, profile→B4); the Phase-2 `/` index is a placeholder `<div>home</div>` — replaced by B2.

---

## BATCH A — Data layer + foundation primitives (do first; unblocks B & C)

### Task A1 — Port the cheap `lib/api` modules (verbatim)
**Source:** `frontend/src/lib/api/{ai,ai-reports,audit-log,connector-resources,mcp-keys,media,pending-adjustments,social-accounts,users}.ts`. **Target:** same paths under `frontend-react/src/lib/api/`. Copy VERBATIM, fixing only the client import path if needed (`$lib/api/client`→`./client`); `diff -w` to confirm only imports changed (Phase-2 found these byte-identical). One representative `fetch`-stub test per 2–3 modules. **DoD:** modules exist, `diff -w` clean, suite green, build clean.

### Task A2 — Port `campaigns` + `posts` api + FINISH `legal.ts`
**Source:** `frontend/src/lib/api/{campaigns.ts (307),posts.ts (85),legal.ts (46)}`. Port campaigns + posts verbatim (they back social & ads). For legal: ADD the `LegalBlock`/`LegalVersion` types + the legal-version functions the Svelte legal.ts exports (the React legal.ts currently has ONLY `setUserSystemRole` from Phase-2 T5). Representative tests for campaigns (the largest) + the new legal fns. **DoD:** `diff -w` clean for campaigns/posts; legal.ts now complete; suite/build green.

### Task A3 — Extend `lib/query` (qk + helpers) for the new entities
**Target:** `frontend-react/src/lib/query.ts`. Add query keys for campaigns, posts, audit-log, mcp-keys, pending-adjustments(alerts), social-accounts, connector-resources, legal, ai-reports (mirror the `qk.*` factory style; keep `fallbackQuery`). Unit-test a couple of key shapes. **DoD:** keys typed & tested; build green.

### Task A4 — `Drawer` headerless mode + theme store/`ThemeToggle`
**Targets:** `src/components/ui/drawer.tsx`, `src/store/theme.ts` (new), `src/components/theme-toggle.tsx` (new). (1) Add an optional `headerless`/custom-header mode to `Drawer` (Phase-2 friction: the users drawers wanted a custom header). Keep the default behavior; add a prop so a drawer can render its own header. Update existing drawer consumers only if cleaner. (2) Port `theme.svelte.ts` → a Zustand theme store (`light|dark|system`, persisted, applies `document.documentElement` class) + a `ThemeToggle` using `THEME_OPTIONS` (Sun/Moon/Monitor). **DoD:** drawer mode tested; theme toggles + persists; suite/build green.

### Task A5 — Shared primitives: `Tabs` + `DropdownMenu`
**Targets:** `src/components/ui/tabs.tsx`, `src/components/ui/dropdown-menu.tsx`. Build thin on `@base-ui/react` (Tabs + Menu parts — both already available). The users page hand-rolled tabs and the tenant toolbar hand-rolled a `useState` dropdown; settings/social/ads need a real Tabs + a proper Menu (client switcher, row action menus). Formalize both as primitives; refactor the Phase-2 hand-rolled tabs/dropdown to use them if low-risk (else leave + note). **DoD:** primitives tested; build green.

---

## BATCH B — Global + tenant-settings routes (moderate; reuse existing primitives)

> Each task: read the Svelte `+page.svelte` (+ `+page.ts`) source first; loader→`useQuery`+`fallbackQuery`; add the `beforeLoad` auth guard used on every authenticated route; reuse `DataTable`/`ConfirmDialog`/`Drawer`/`Select`/`SectionTitle`/`Skeleton`. e2e: seed `meisterfy_session` + mock the route's endpoints to empty (mirror `e2e/users.spec.ts`).

### Task B1 — `/tenants/new` (create tenant) — source `routes/tenants/new/+page.svelte` (96)
dep: `tenants` (✓). Form → `createTenant`. On success navigate to the new tenant. **Unblocks** the login `needs_tenant` redirect + toolbar "Create Client" link. Wire those typed `<Link>`s here.

### Task B2 — `/` home — "all clients" dashboard — source `routes/+page.svelte` (160) + `routes/+layout.svelte` (32)
dep: `tenants` (✓). Replaces the Phase-2 placeholder `index.tsx`. Lists tenants (BrandIcon cards/links to `/$tenant/...`), keeps the auth guard. Port the root `+layout.svelte` shell concerns (global providers already in `app.tsx` — only port what's missing, e.g. a top bar/footer; note deviations).

### Task B3 — `/setup` (first-run) — source `routes/setup/+page.svelte` (161)
First-run/onboarding. Confirm the loader/guard semantics (pre-tenant). Mirror the form/steps.

### Task B4 — `/profile` — source `routes/profile/+page.svelte` (280)
dep: `users` api (A1) + `auth` store. Profile fields + password change. Wire the toolbar profile link → this route. Reuse Input/Button/Select/Alert.

### Task B5 — `/settings` layout + index — source `routes/settings/+layout.svelte` (57) + `+page.ts`
The global (non-tenant) settings shell that hosts `integrations` (✓) + `legal`. Make `/settings/integrations` a child of this layout (re-parent the Phase-2 route). Index likely redirects.

### Task B6 — `/settings/legal` — source `routes/settings/legal/+page.svelte` (307)
dep: legal (A2). Legal blocks/versions management.

### Task B7 — `/[tenant]/settings` layout + index — source `routes/[tenant]/settings/+layout.svelte` (93) + index (3)
The tenant-settings shell (sub-nav for general/users/roles/audit/mcp/social/google-ads). Re-parent the Phase-2 `users` route under it. Index = redirect (→ users or general). **Wire the tenant toolbar's Settings link → this layout (typed `<Link>` + active state).**

### Task B8 — `/[tenant]/settings/general` — source (232)
Tenant brand/profile settings. dep: tenants. Reuse form primitives.

### Task B9 — `/[tenant]/settings/audit` — source (299)
dep: audit-log (A1). Reuse `DataTable` (consider extending DataTable with the sort/pagination/search that Phase-2 deferred — see the Svelte data-table.svelte; do it here if the audit log needs it, as a `DataTable` enhancement task-in-task).

### Task B10 — `/[tenant]/settings/roles` — source (583) — **DECOMPOSE**
dep: admin-users (✓; roles/permissions fns). Big. Decompose like the users slice: a roles data hook, a roles table, a role drawer (create/edit) + a **permissions matrix** component, then the route. Reuse Drawer/ConfirmDialog/DataTable. **P1-L.**

### Task B11 — `/[tenant]/settings/mcp` — source (421)
dep: mcp-keys (A1). Key list (DataTable) + create + revoke (ConfirmDialog). Note: the Svelte `settings_mcp_revoke_confirm` key. Decompose if it grows.

### Task B12 — `/[tenant]/settings/social` — source (293)
dep: connector-resources (A1) + social-accounts (A1). Social account connections management.

### Task B13 — `/[tenant]/settings/google-ads` — source (526) — **DECOMPOSE**
dep: ai (A1) + tenants. Ads monitoring config + report prompts (the `ads_monitoring`/`report_prompts` on Tenant). Big — decompose into config form sections + the route. **P1-L.**

---

## BATCH C — Social + Ads (heavy; the runes-class ports — two-stage review)

### Task C1 — `campaign-actions.svelte.ts` (61) → `useCampaignActions` hook
**Source:** `frontend/src/lib/runes/campaign-actions.svelte.ts`. Port the runes class to a page-scoped hook (state+actions, functional-updater discipline). Inject/import `campaigns` api. **TWO-STAGE REVIEW** (spec reviewer subagent → fix). Used by the ads list `columns.ts` + the live campaign route. **P1-M.**

### Task C2 — `campaign-chat.svelte.ts` (135) → chat store/hook + `floating-chat` component
**Source:** `frontend/src/lib/stores/campaign-chat.svelte.ts` + `frontend/src/lib/components/chat/floating-chat.svelte`. Port the chat store (Zustand or a hook) + the floating-chat UI. dep: ai/ai-reports + campaigns. **TWO-STAGE REVIEW.** **P1-L.**

### Task C3 — `/[tenant]/social` layout (38) + `/social` page (69)
dep: posts (A2). Social layout shell + the social feed/landing. Reuse Tabs (A5). **Wire the toolbar Social nav link → here (typed Link + active).**

### Task C4 — `/[tenant]/social/drafts` — source (324)
dep: posts + connector-resources. Drafts list/management.

### Task C5 — `/[tenant]/social/[post_id]` post editor — source (533) — **DECOMPOSE**
dep: posts + media (A1) + the chat (C2). The post composer/editor — the heaviest social route. Decompose into editor sub-components (composer, media picker, preview, schedule) + the route. **P1-L.**

### Task C6 — `/[tenant]/alerts` — source (179)
dep: pending-adjustments (A1). Reuse DataTable/ConfirmDialog. **Wire the toolbar Alerts nav link.**

### Task C7 — `/[tenant]/ads/google` list — source (221) + `columns.ts`
dep: campaigns (A2) + `useCampaignActions` (C1). Campaign list (DataTable with the action columns from `columns.ts`). **Wire the toolbar Ads nav link.**

### Task C8 — `/[tenant]/ads/google/[slug]` — source (262)
dep: campaigns. Campaign detail by slug.

### Task C9 — `/[tenant]/ads/google/live/[campaign_id]` — source (145) + `components/header.svelte`
dep: campaigns + `useCampaignActions` (C1) + chat (C2). The live campaign view.

---

## BATCH D — Finalize + cutover

### Task D1 — i18n pt-BR completeness pass
Close the inherited pt-BR gaps (Phase-2 found pt-BR namespaces incomplete vs EN, e.g. integrations). Reconcile every bundled namespace EN↔pt-BR; add a guard test that asserts key-set parity per namespace.

### Task D2 — Regression: port remaining Playwright flows + full green
Map the remaining Svelte e2e (`frontend/e2e/{setup,social}.spec.ts`) onto React specs for the now-ported routes (backend-independent assertions; document backend-gated ones). Ensure full `bun run test` + `bun run test:e2e` green and `bun run build` clean across the whole app.

### Task D3 — CUTOVER (ADR-001 single cutover commit) — **P1-L, human-gated**
Point build/CI/dev scripts, the dev port, and any deploy config at `frontend-react/`; retire/relocate the Svelte `frontend/`; update root README/CLAUDE.md migration section to reflect React as the live SPA. This is the irreversible swap on (or merging to) `main` — **requires explicit operator sign-off** before executing. Final full-suite + build gate.

---

## Definition of Done (Phase 3 / migration complete)
- Every Svelte route under `frontend/src/routes/**` has a faithful React counterpart; every `lib/api` module ported; both runes state-classes (`campaign-actions`, `campaign-chat`) ported; theme toggle + shared Tabs/Dropdown primitives exist; tenant toolbar links are real typed `<Link>`s with active state.
- pt-BR i18n at parity with EN. `bun run test` + `bun run test:e2e` green; `bun run build` clean.
- Cutover done (operator-signed): React is the deployed SPA; Svelte retired. ADR-001 closed.

## Suggested execution order
A1→A2→A3→A4→A5 (foundation), then B1→B13 (B1/B7 early to de-inert the toolbar), then C1→C2 (state classes) before C3–C9 (their consumers), then D1→D2, and finally **D3 only after operator go**. One AIPIM task at a time, in this order.
