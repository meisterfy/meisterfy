# ADR 002 — Charting and Markdown dependencies for the React frontend

- **Status:** Accepted
- **Date:** 2026-06-11
- **Context owner:** Rafhael (operator decision)
- **Relates to:** [ADR 001](001-migrate-frontend-from-svelte-to-react.md) (Svelte→React migration), Phase 3 Task C9 (live campaign dashboard).

## Context

The live Google Ads campaign dashboard (`[tenant]/ads/google/live/[campaign_id]`)
is the most chart-heavy surface in the app: ~12 visualisations (performance
timeline, daily cost/CPA, day-of-week bars, device breakdown, hourly heatmap,
impression-share, monthly metrics, etc.) plus a streamed AI report rendered
from Markdown.

On the Svelte side these are built with **chart.js** (`chart.js@4`), fed by
pure `ChartConfiguration` builders in `src/lib/utils/charts.ts`, and the AI
report tab renders Markdown via **marked**.

The React app (`frontend-react/`) had **no charting library**. We needed to
choose how to bring these visualisations across while honouring the migration's
anti-bloat principle (ADR 001: weigh a library's cost against doing it with a
little code) and its faithful-parity goal.

## Decision

Adopt the same charting stack as Svelte, wrapped for React:

- **`chart.js@4`** — identical major to the Svelte side, so the existing
  `ChartConfiguration` builders in `utils/charts.ts` port ~1:1.
- **`react-chartjs-2@5`** — the standard React wrapper; renders charts as
  `<Line>`/`<Bar>` components driven by the ported config objects, instead of
  hand-managing canvas refs and `new Chart()` lifecycles in every component.
- **`marked@18`** — Markdown→HTML for the AI report tab (same lib as Svelte).

## Rationale

- **Faithful parity, least new code.** The `ChartConfiguration` objects are the
  real logic; reusing chart.js means `utils/charts.ts` is a near byte-identical
  port and the 12 charts stay visually identical. Hand-rolling SVG would mean
  re-deriving every axis/scale/tooltip and risking visual drift across a dozen
  components — far more of *our* code to own, the opposite of anti-bloat here.
- **react-chartjs-2 over raw chart.js.** A thin (~3 KB) wrapper that removes
  repetitive `useRef`/`useEffect`/`Chart.register` boilerplate from each chart
  component and handles React unmount cleanup correctly. The marginal extra
  dependency buys uniform, less error-prone chart components.
- **Cost is bounded and proven.** chart.js + marked are already trusted in
  production on the Svelte side; this is matching an existing, vetted choice,
  not introducing a novel one.

## Consequences

- Three runtime dependencies added to `frontend-react`: `chart.js`,
  `react-chartjs-2`, `marked`.
- `chart.js` components must be registered once (e.g. a shared
  `lib/utils/charts.ts` registration or a small chart wrapper) before use.
- Bundle grows by the chart.js footprint; the dashboard route is lazy-loaded
  (TanStack file route code-splitting) so it is not paid on first load.
- Markdown from the AI provider is rendered as HTML — sanitisation posture
  matches the Svelte original (trusted first-party model output); revisit if
  untrusted Markdown sources are ever introduced.
