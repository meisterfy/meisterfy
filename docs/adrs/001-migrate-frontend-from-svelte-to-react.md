# ADR 001 — Migrate the frontend from Svelte to React

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Rafhael Marsigli (author/operator) + Claude (technical sparring)
- **Decision context:** technical/business brainstorming session, 2026-06-09
- **Supersedes / superseded by:** —

---

## TL;DR

We are **rewriting the Meisterfy frontend from SvelteKit to React**, on a dedicated branch, with the Svelte base untouched on `main` until cutover. The reason is **not** that Svelte is worse — it is that, in this project (solo, AI-orchestrated, with heavy UI iteration ahead), **both the AI and the operator are more effective in React**. That changes the calculation entirely.

---

## Context

Meisterfy is a multi-tenant platform (social media management, integrations, campaigns, AI-driven reports) with a **Go backend** and a **SPA frontend** built in **SvelteKit + Svelte 5 (runes)**, served as a static bundle (`adapter-static`, `ssr = false`) and talking to the backend over REST. The frontend today has ~139 `.svelte` components, 22 routes, ~14k lines of templates and ~5.7k of TS, i18n via paraglide (613 keys), UI via bits-ui, styling with Tailwind v4.

The codebase is **functional and freshly security-audited**. Nothing is "broken" in a way that, on its own, would justify a rewrite. In fact, the three pain points that surfaced on the day of this decision — login (a missing DB migration), a misaligned modal (a previous agent hand-rolled positioning and doubled the `translate`), and an ungenerated i18n file — **were none of them the Svelte language's fault**. They were the database, an AI mistake in a niche library, and tooling.

So why touch a winning team?

Because the real pain was not in the day's bugs. It was an accumulated pattern: **weeks of tokens spent trying to orchestrate the Svelte frontend with AI, never reaching the intended lean result, and never being able to intervene by hand with enough confidence to correct course.** That is the symptom that matters, and it is not fixed by refactoring a file.

## The real question

It was never "is React better than Svelte?" (a bar argument with no useful answer). It was:

> Given **this** project, **this** operator, and **this** way of working (AI writing most of the code), which stack maximizes the odds of producing good software, fast, that the operator can maintain?

## The forces in tension

During the debate, two principles emerged that sometimes **fight** each other. They became the project's decision ruler:

- **Principle A — AI fluency:** prefer tools the AI writes well. In practice this favors the mainstream, with a large training corpus.
- **Principle B — Future-proofing:** prefer tools that will not become debt and force a "rip-and-replace" a year from now.

The rule we adopted: **default to modern, but make a conscious per-slot decision, weighing A vs B case by case. Never dogma, never closed-minded.** (Routing, below, is a case where B beat A — and that is fine.)

## The variable that decided everything: operator expertise asymmetry

The central insight — the one that flipped my initial assessment from skeptic to in favor — is that **the value of a stack in a solo, AI-orchestrated project is not an absolute property of the stack.** It is a product:

```text
value_for_this_team = (how well the AI writes the stack) × (how well the operator fixes it when the AI is wrong)
```

Applied to the real case:

| Axis | Svelte 5 | React |
| --- | --- | --- |
| Does the AI write it well? | **No** — runes shipped late 2024; the corpus is dominated by Svelte 3/4 (`export let`, `$:`, stores). The AI regresses to old syntax and hallucinates new APIs. Combined with niche libs (bits-ui, paraglide), training is thin. | **Yes** — huge, stable corpus. |
| Can the operator fix it well? | **No** — insufficient Svelte 5 mastery to confidently correct the AI's orchestration. | **Yes** — solid expertise; audits and fixes almost as fast as reading. |

Svelte **loses on both axes** for this team. React **wins on both**. When the AI *and* the human are more effective in the same tool, that tool is the correct one — regardless of the framework's abstract merit. The "weeks of burned tokens" are the empirical evidence, not a feeling.

It is honest to record the counterpoint: Svelte 5 is, as a language, leaner and more performant than equivalent React. Someone with **deep Svelte 5 mastery** would likely not migrate. This decision is specific to this operator and this way of working — and it is correct precisely because it is specific.

## ROI: why now, and not "leave it alone"

The only serious counter-argument was opportunity cost: a rewrite delivers **zero new features** for weeks. That only pays off if there is **heavy frontend evolution ahead** — because then every future change would pay the "Svelte tax," and migrating amortizes it.

And there is. The near-term roadmap is UI-intensive:

- **Evolution API connector** (WhatsApp) — a client already wants to see it working, with possible investment.
- **Evo API dispatches** with **reports**.
- **AI-powered auto-replies.**
- Possibly **real-time chat.**

That is **many new screens**. The tax recurs. Therefore the migration ROI is clearly positive: it pays back quickly and avoids dragging the friction across the entire roadmap.

## Decision

**Migrate the frontend to React**, with the following stack (decided slot by slot, with the explicit A vs B rationale):

| Slot | Choice | Rationale |
| --- | --- | --- |
| Build/runtime | **Vite + bun** | Kept. Agnostic, fast. |
| Language | **React + TypeScript** (latest stable) | Huge corpus (Principle A). Ends the template-DSL/script duality. |
| Routing | **TanStack Router** | **Here B beat A:** the operator has used React Router and found it bloated; TanStack gives type-safety and longevity. Smaller corpus, but with real momentum (it is the Lovable default). AI friction is limited to the route-tree setup. |
| Data fetching | **TanStack Query** | Mature, AI knows it well. Maps the 23 `+page.ts` (client-side loaders). |
| State | **Zustand** | Light, mainstream. Replaces the `.svelte.ts` stores. |
| UI | **shadcn on Base UI** (with **Radix as a per-component fallback**) | shadcn = you own the files (future-proof + anti-bloat). Base UI is more modern; the residual risk (thin corpus) is small and contained to ~12 primitives, mitigated by the fallback clause: if a Base UI primitive is immature or the AI gets stuck on it, swap *that file* for Radix. |
| Styling | **Tailwind v4** | Reuses `app.css` almost intact (including dialog rules, rewritten for Base UI `data-*` attributes). |
| i18n | **react-i18next** (lean mode: bundled JSON + typing via `i18next.d.ts`) | Operator's choice (#4): mature ecosystem, AI knows it well. Configured lean to claw back the leanness paraglide had. |
| Testing | **Vitest + Testing Library + Playwright** | Carry over from the current setup. Playwright becomes the regression net (below). |

### Explicitly not Next.js

Next.js is **off the table in any scenario**. This is a static SPA talking to a Go backend: SSR/server-components/streaming would be dead weight and bloat. A decision of principle, not convenience.

## Execution strategy (summary)

The stack is not what makes or breaks a "100% AI" migration — **execution** is. Operational details live in the implementation plan; the essentials:

1. **Topology:** dedicated branch. `frontend/` (Svelte) stays **untouched** on `main` and remains deployable. `frontend-react/` is created alongside it. Cutover is a single rename commit (`rm -rf frontend && mv frontend-react frontend`). The AI ports with both files side by side (`.svelte` → `.tsx`).
2. **Regression net before porting:** the 23 Playwright flows run against the live Svelte app = **the behavioral spec**. The same flows must pass on React. This is what catches "the AI built it subtly wrong."
3. **Phasing:** (0) scaffold + CI → (1) core infra: `lib/api`, `store/auth`, i18n (migrate 613 keys), shadcn primitives → (2) **proof slice** (login + integrations[modal] + one route with heavy `$effect`) and a **calibration stop** to measure token/effort/quality → (3) remaining routes in batches, simple→hard → (4) cutover.
4. **Context discipline:** tasks pre-decomposed in AIPIM (task-management MCP), each carrying its file pair and its "definition of done," so the agent does not burn tokens re-exploring the repo. Agent memory + AIPIM are the resilience backbone (see `CLAUDE.md`).

## Alternatives considered

1. **Stay on Svelte and "make it my way" (refactor into `/hooks` `/store`, improve AI rules).** Rejected. It fixes only the cosmetic complaint (file structure); it **does not touch the decisive pain** (thin AI corpus + operator's mastery gap), which is unfixable by refactoring.
2. **Migrate to Next.js / mainstream-heavy React.** Rejected. Bloat for a static SPA; contradicts the project's anti-bloatware principle.
3. **Bleeding-edge React everywhere (Base UI + new minimalist libs in every slot).** Rejected as a general rule. It would re-import the thin-corpus problem that motivated leaving Svelte. Adopted only where the cost is small and contained (UI).
4. **Do nothing.** Rejected on ROI: a heavy frontend roadmap means the Svelte tax recurs on every new screen.

## Consequences

### Positive

- The AI generates code the operator can audit and fix → fewer burned tokens, fewer "dead-end hallucinations."
- Explicit `/hooks` `/store` structure, the way the operator prefers.
- Mainstream ecosystem for the entire UI-intensive roadmap (Evo API, real-time chat).
- Backend, API contract, and most of `lib/api` and `locales` are reused.

### Negative / costs (honest)

- **Weeks** of work to reach **parity**, with **zero new features** in that window.
- The "100% AI" migration carries the same risk that motivated the move: the AI produces subtle bugs in a large rewrite (cf. the modal). Mitigated — not eliminated — by the Playwright regression net + human review.
- Non-trivial token cost (139 components).
- Throws away a functional, freshly audited Svelte base. Sunk cost acknowledged and accepted in exchange for the recurring benefit.

### What does NOT change

- Go backend (zero changes).
- REST contract.
- Tailwind v4 and `app.css`.
- Vite + bun as the build tooling.

## How we will know it worked

- The 23 Playwright flows pass on React (behavioral parity).
- The proof slice (Phase 2) confirms the per-route token/time cost is acceptable **before** committing to the rest.
- The operator can review and fix the generated code without the friction they had in Svelte.
- The first **new** feature post-cutover (likely the Evo API connector) ships faster and cleaner than it would in Svelte.

---

> **Intellectual-honesty note:** this ADR started with the technical sparring *against* the migration (part of the initial justification was misattributing blame to Svelte). The decision turned to "migrate" when the **operator expertise asymmetry** variable entered the picture — not by comfortable consensus, but by argument. Recorded here so a future agent understands this was not a hype choice, but a context-specific calculation.
