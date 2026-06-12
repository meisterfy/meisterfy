# React Migration — Phase 2 (Proof Slice) Calibration Report

**Date:** 2026-06-10 · **Branch:** `claude/react-migration` · **Status:** Phase 2 COMPLETE — awaiting operator go/no-go for Phase 3.

This is the calibration STOP mandated by ADR-001 and the Phase-2 plan (Task 25). It measures the
token/effort/quality cost of porting the proof slice (**login + integrations + `[tenant]/settings/users`**)
from SvelteKit to React, so the operator can decide whether — and how — to batch the remaining routes.

## What was delivered

All 25 plan tasks done. Proof-slice routes live and faithful: `/login`, `/settings/integrations`
(with modal + confirm-delete), `/$tenant/settings/users` (tabs, table, invite/edit/reactivate drawers,
deactivate confirm). Foundation: token reconciliation, `lib/api` ports (integrations/tenants/admin-users/
legal-partial), `lib/utils/loader` + `lib/query`, primitives (skeleton/drawer/multi-select/confirm-dialog/
data-table/sonner), display components, the `useIntegrationManager` hook, the `$tenant` layout.

**Gates:** Vitest **150/150**, Playwright **8/8**, `tsc -b && vite build` clean, `frontend/` (Svelte) untouched.
New deps added: `sonner`, `@tanstack/react-table` only. Anti-bloat held (Drawer/MultiSelect built thin on
existing `@base-ui/react`; legal.ts ported partially; no Phase-3 routes pre-built).

## Method

`superpowers:subagent-driven-development`: the controller read each Svelte source, curated a full-spec
prompt (embedding the source), and dispatched **one Sonnet implementer per task**. Verbatim/thin pieces
were spec-checked by the controller reading the file (no separate review subagent). The one flagged risky
unit — the runes-class → hook port — got the full two-stage review (spec reviewer subagent → fix subagent).

## Cost per area (approx. implementer subagent tokens)

| Area | Tasks | Subagent tokens | Notes |
| --- | --- | --- | --- |
| Foundation — `lib/api` ports | T3–T5 | ~free (byte-identical) | Framework-agnostic; source already used `./client` |
| Foundation — primitives/display | T6–T12 | ~18–27k each (~160k total) | skeleton/drawer/multi-select/confirm-dialog/data-table/sonner + 4 display |
| **Login route** | T13 | **~46k** | Cheapest route: one form, no loader; full markup + 7 unit + 2 e2e |
| **Integrations slice** | T14–T17 | **~269k** | Cost driven by T14 |
| ↳ `useIntegrationManager` (228-line runes class → hook) | T14 | **~113k** | 38k impl + 38k spec-review + 37k fix — **the single cost driver of the phase** |
| ↳ filters/section/cards (8 files) | T15 | ~53k | Presentational; pulled in connection-card/footer-btn/badge helpers |
| ↳ integration modal (182 lines) | T16 | ~48k | Dialog + MultiSelect + Select + FieldGroup |
| ↳ route assembly + e2e | T17 | ~55k | 2 useQuery + hook wiring + skeleton scaffold + guard + e2e |
| **Users slice** | T18–T23 | **~256k** | The 692-line page, decomposed |
| ↳ tenant layout + toolbar | T18 | ~44k | Scope-creep risk held; nav links inert (Phase 3) |
| ↳ data hook + pure helpers | T19 | ~43k | |
| ↳ users table | T20 | ~36k | |
| ↳ invite/edit/reactivate drawers | T21 | ~52k | + controller test-infra debugging |
| ↳ route (tabs+table+drawers+confirm) | T22 | ~46k | + controller build-fix |
| ↳ e2e | T23 | ~35k | |
| Regression mapping | T24 | ~tiny (controller) | |

**Per-route headline:** login ≈ 46k · integrations ≈ 269k · users ≈ 256k. Login is ~5× cheaper than the
two complex routes; the gap is almost entirely the stateful-logic ports (the runes class in integrations,
the 6-way decomposition in users).

## What was cheap vs costly

- **Cheap / near-free:** the `lib/api` modules ported byte-identically (the data layer is framework-agnostic).
  Pure helpers (`avatarColor`/`initials`) and thin primitives (skeleton). These can be batched aggressively.
- **Costly:** the **runes-class → hook** port (T14) — translating `$state`/`$derived`/`$effect` + a stateful
  class into `useState`/`useMemo`/`useCallback` with correct functional-updater discipline and URL-derived
  state. This is the only unit that needed the full two-stage review, and the review caught real quality
  issues (a non-memoized constant recreated each render; missing tests for the oauth-redirect and error
  branches) — no correctness bugs, but the review paid for itself.
- **Moderate:** route assemblies (T17/T22) and the presentational card cluster (T15). The 692-line users
  page was NOT costlier than integrations once decomposed — splitting it into helpers/hook/table/drawers/
  route/e2e kept every task in the ~35–52k digestible range.

## Friction surfaced (fix before/in Phase 3)

1. **Primitive-contract mismatch at integration time.** The `Drawer` primitive (T8) was built with a
   mandatory title + close header, but the users drawers (T21) wanted a custom header with a Cancel button.
   Resolved by using the built-in header + a footer Cancel, but **Phase 3 should give `Drawer` an optional/
   headerless mode** (or standardize drawers on the built-in header) to avoid the friction recurring.
2. **jsdom gaps for `@base-ui`.** Select/Popover/Dialog call `scrollTo`/`scrollIntoView`/pointer-capture,
   which jsdom doesn't implement → `user-event` stalled → flaky/timing-out interaction tests. **Fixed
   centrally** in `src/test-setup.ts` (guarded stubs) + `testTimeout: 15000`. Future interaction tests
   inherit this; no per-test workarounds needed.
3. **Subagents misreport build state.** A test-infra edit broke `tsc -b` (a `'x' in window` guard narrowed
   `window` to `never`); a downstream implementer ran the build, saw the error, but labeled it "pre-existing."
   **Process fix: the controller must run `tsc -b` itself after any test-infra/config change** — don't trust
   "build clean" from a subagent whose task didn't touch the config.
4. **i18n pt-BR incompleteness** (inherited from the Svelte side): EN namespaces are complete; pt-BR has
   gaps (e.g. integrations). Not a migration bug, but Phase 3 should track it.
5. **Typed-router vs not-yet-existing routes.** Inert nav links use plain `<a href>` to avoid compile
   dependencies on Phase-3 routes; upgrade to typed `<Link>` as those routes land.

## Faithfulness / deviations (logged for review)

- `useIntegrationManager`: hard-coded English toasts kept literal (as in source); `GROUP_ORDER` hoisted to
  module const (memoization fix).
- `UsersTable`: the active-tab actions column now also appends when `isPlatformAdmin` (Svelte used only
  `canUpdate || canDelete`) so the platform-admin toggle shows — a defensible edge-case fix, **not byte-faithful**.
- Tenant layout: **no `error(404)`** on missing tenant (lenient fallback so the backend-down slice renders);
  Toolbar/Footer/Dropdown/ProfileLink inlined (not ported as shared primitives); nav active-state stubbed false.
- Users drawers/route: `refetch()` replaces SvelteKit's local-array mutation / `invalidateAll`; `SettingsSkeleton`
  replaced with a minimal inline skeleton.
- MultiSelect: i18n-decoupled (string props with English defaults; consumers pass `t(...)`).

## Recommendation: **PROCEED to Phase 3**, batched simple → hard

The port is high-fidelity and the cost is predictable. Suggested batching:

1. **Batch A — cheap/static & list routes** (reuse `DataTable`/`UsersTable`/drawers/dialogs already built):
   settings sub-pages, simple lists. Mostly markup + a `useQuery`. Budget ~30–60k each.
2. **Batch B — moderate routes** with their own loaders + a few derived bits. Budget ~50–80k each.
3. **Batch C — runes-class-heavy routes** (social, ads/google, alerts, reports/dashboard). These carry the
   `.svelte.ts` class ports — budget **~100–130k each** and apply the two-stage review to each hook port.
   Pre-build any missing primitives (and the `Drawer` headerless mode) at the start of this batch.

Process to keep: one AIPIM task per unit, controller curates the prompt from the Svelte source, Sonnet
implements, controller spec-checks verbatim/thin units by reading and reserves full review for hook ports;
controller runs `tsc -b` + `bun run test`/`test:e2e` after config-touching changes.

**STOP — this is a human checkpoint. Awaiting the operator's go/no-go and any batching adjustments before
starting Phase 3.**
