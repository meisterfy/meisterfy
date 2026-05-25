# i18n audit scope and exclusions

Used by [`i18n-audit.ts`](./i18n-audit.ts).

| Command | Purpose |
|---------|---------|
| `bun run i18n:audit` | Regenerate `.project/reports/i18n-audit/{i18n-audit.json,i18n-audit.md,i18n-audit-inventory.md}` |
| `bun run i18n:audit:check` | CI: locale parity + routes `quick_win` must not exceed baseline |

Baseline: [`.project/reports/i18n-audit/i18n-audit-baseline.json`](../../.project/reports/i18n-audit/i18n-audit-baseline.json). After fixing route strings, lower `routes_quick_win_max` and commit.

## Included

| Area | Paths |
|------|-------|
| Svelte UI | `frontend/src/**/*.svelte` |
| UI TypeScript | `frontend/src/**/*.ts`, `*.svelte.ts` (labels, columns, toasts) |

## Excluded paths (never scanned)

- `src/lib/paraglide/**`, `src/paraglide/**`
- `**/__test-mocks__/**`, `**/vitest-examples/**`
- `**/*.test.ts`, `**/*.spec.ts`, `**/*.test.svelte`

## Excluded content (false positives)

- URLs, route paths, Tailwind classes, hex colors, pure numbers
- Dynamic bindings: `title={...}`, `placeholder={expr}`, attribute values with `{expression}`
- API-driven copy: tenant names, connector names, user names
- Brand names (kept literal): `Meisterfy` — see `BRAND_LITERALS` in script
- `console.*`, comments, env keys, technical IDs (snake_case, UUIDs)
- Strings shorter than 2 characters or without letters

## Suppressions

- Line: `<!-- i18n-ignore -->` or `// i18n-ignore` on the previous line
- File: `/* i18n-audit:ignore-file */` in the first 5 lines

## Priority rubric

| Class | Meaning |
|-------|---------|
| `quick_win` | Hardcoded text matches an existing `namespace:key` in `locales/en` |
| `must` | User-facing copy (buttons, headings, empty states, errors) |
| `should` | `title`, `aria-label`, `alt` on product actions |
| `maybe` | SEO-related file paths (`seo.svelte`) |
| `skip` | Classified as non-UI per rules above |

## Locales

- Source of truth: `frontend/locales/{en,pt-BR}/*.json`
- Namespaces: `globals`, `auth`, `settings`, `integrations`, `tenants`, `ads`, `social-media`, `permissions`
- Paraglide usage: `m['namespace:key']()` from `$lib/paraglide/messages`

## Backend

Out of scope for this audit (UI Paraglide only). API error i18n is a separate effort.
