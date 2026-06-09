# React Migration — Phase 0 & 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each top-level Task maps to one AIPIM task (TASK-080..TASK-089).

**Goal:** Stand up the new React frontend (`frontend-react/`) and port the framework-agnostic core infrastructure (API client, auth store, i18n, UI primitives) — with zero product features yet, but fully booting, typed, tested, and ready for per-route porting in Phase 2+.

**Architecture:** Vite + React SPA on a dedicated branch, living in `frontend-react/` next to the untouched Svelte `frontend/`. Client-side only (no SSR — mirrors the Svelte `adapter-static` + `ssr=false` setup). Talks to the Go backend through the same dev proxy. Core logic that is framework-agnostic (`lib/api/*`) is copied nearly verbatim; reactive state (Svelte runes / `.svelte.ts`) is reimplemented in Zustand; bits-ui components are replaced by shadcn-on-Base-UI.

**Tech Stack:** Vite, bun, React, TypeScript, TanStack Router, TanStack Query, Zustand, shadcn/ui on Base UI, Tailwind v4, react-i18next, Vitest + Testing Library + Playwright.

**Authoritative context:** see ADR `docs/adrs/001-migrate-frontend-from-svelte-to-react.md` and `CLAUDE.md` (working model). The Svelte source is the behavioral spec — read the `.svelte`/`.svelte.ts` original before porting each piece.

---

## File Structure (Phase 0/1 deliverables)

```
frontend-react/
  package.json                 # bun scripts: dev, build, test, test:e2e, lint
  vite.config.ts               # React plugin, Tailwind v4, dev proxy -> :8181, vitest config
  tsconfig.json
  index.html
  playwright.config.ts         # points at the dev server
  components.json              # shadcn config (Base UI style)
  src/
    main.tsx                   # mounts <App/>
    app.tsx                    # providers: QueryClient, Router, i18n, auth bootstrap
    routes/
      __root.tsx               # TanStack root route (layout shell)
      index.tsx                # placeholder "/" route
    store/
      auth.ts                  # Zustand store — port of auth.svelte.ts
    lib/
      api/
        client.ts              # port of frontend/src/lib/api/client.ts (verbatim)
      i18n/
        index.ts               # react-i18next init (bundled, typed)
        resources.ts           # generated: imports the migrated JSON
    locales/                   # migrated from paraglide (en/, pt-BR/)
    components/ui/             # shadcn primitives (Base UI)
    styles/app.css             # ported Tailwind globals (+ dialog rules for Base UI)
  scripts/
    migrate-i18n.ts            # one-shot: paraglide locales -> react-i18next JSON
  i18next.d.ts                 # typed translation keys
tests/                         # vitest unit + playwright e2e live under frontend-react/
```

---

## PHASE 0 — Scaffold

### Task 1: Initialize the React app

**Files:**
- Create: `frontend-react/package.json`, `frontend-react/vite.config.ts`, `frontend-react/tsconfig.json`, `frontend-react/index.html`, `frontend-react/src/main.tsx`, `frontend-react/src/app.tsx`

- [ ] **Step 1: Scaffold with Vite (React + TS) via bun**

Run from repo root:
```bash
bun create vite@latest frontend-react --template react-ts
cd frontend-react && bun install
```

- [ ] **Step 2: Add the dev proxy (mirror the Svelte vite.config) and Vitest config**

Replace `frontend-react/vite.config.ts` with:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '^/(admin|auth|setup|health|mcp|ai)': 'http://localhost:8181'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    expect: { requireAssertions: true }
  }
})
```

- [ ] **Step 3: Boot the dev server and verify it serves**

Run: `bun run dev` then in another shell `curl -s -o /dev/null -w "%{http_code}" http://localhost:5174`
Expected: `200` (use port 5174 to avoid clashing with the live Svelte app on 5173).
Set the port in `package.json` dev script: `"dev": "vite --port 5174"`.

- [ ] **Step 4: Prettier (single quotes, no semicolons) + kebab-case convention**

```bash
cd frontend-react && bun add -D prettier
```

Create `frontend-react/.prettierrc`:
```json
{ "singleQuote": true, "semi": false }
```

Add script `"format": "prettier --write ."`. **Convention for this whole package:** every file is kebab-case (`app.tsx`, not `App.tsx`); React component identifiers stay PascalCase. All code uses single quotes and no semicolons.

- [ ] **Step 5: Commit**

```bash
git add frontend-react
git commit -m "chore(react): scaffold frontend-react with vite+react+ts+prettier"
```

### Task 2: Tailwind v4 + ported global styles

**Files:**
- Create: `frontend-react/src/styles/app.css`
- Modify: `frontend-react/src/main.tsx` (import the css)
- Reference: `frontend/src/app.css` (source to port)

- [ ] **Step 1: Install Tailwind v4 Vite plugin**

```bash
cd frontend-react && bun add -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Port the global stylesheet**

Copy `frontend/src/app.css` to `frontend-react/src/styles/app.css` **verbatim for now**. The `[data-dialog-content]` / `[data-drawer-content]` rules will be re-pointed to Base UI attributes in Task 10 — leave them as-is in this task.

- [ ] **Step 3: Import it and verify Tailwind classes apply**

In `src/main.tsx` add `import './styles/app.css'`. Add a `className="text-indigo-600"` to a test element, run `bun run dev`, confirm the color renders.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore(react): tailwind v4 + ported global styles"
```

### Task 3: TanStack Router skeleton

**Files:**
- Create: `frontend-react/src/routes/__root.tsx`, `frontend-react/src/routes/index.tsx`
- Modify: `frontend-react/src/app.tsx`, `frontend-react/vite.config.ts`

- [ ] **Step 1: Install router + plugin**

```bash
cd frontend-react && bun add @tanstack/react-router && bun add -D @tanstack/router-plugin
```

- [ ] **Step 2: Wire the router plugin in vite.config.ts**

Add to the `plugins` array (before `react()`):
```ts
import { tanstackRouter } from '@tanstack/router-plugin/vite'
// plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), ...]
```

- [ ] **Step 3: Create the root and index routes**

`src/routes/__root.tsx`:
```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => <Outlet />
})
```

`src/routes/index.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <div data-testid="home">Meisterfy React — scaffold OK</div>
})
```

- [ ] **Step 4: Mount the router in app.tsx**

```tsx
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })
declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

export default function App() {
  return <RouterProvider router={router} />
}
```

- [ ] **Step 5: Verify the route renders**

Run `bun run dev`, load `http://localhost:5174`, confirm "Meisterfy React — scaffold OK" appears (the `routeTree.gen.ts` is generated by the plugin on dev start).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(react): tanstack router skeleton with root + index routes"
```

### Task 4: TanStack Query + Vitest/Testing Library smoke test

**Files:**
- Create: `frontend-react/src/test-setup.ts`, `frontend-react/src/app.test.tsx`
- Modify: `frontend-react/src/app.tsx`, `frontend-react/package.json`

- [ ] **Step 1: Install testing + query deps**

```bash
cd frontend-react && bun add @tanstack/react-query && bun add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Test setup file**

`src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Wrap App in QueryClientProvider**

In `src/app.tsx`, create one `QueryClient` and wrap `<RouterProvider>`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient()
// return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
```

- [ ] **Step 4: Write the failing smoke test**

`src/app.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { describe, it, expect } from 'vitest'

describe('router smoke', () => {
  it('renders the home route', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <div data-testid="home">ok</div>
    })
    const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) })
    render(<RouterProvider router={router} />)
    expect(await screen.findByTestId('home')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run the test**

Add to `package.json` scripts: `"test": "vitest run"`. Run: `bun run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "test(react): tanstack query provider + vitest smoke test"
```

### Task 5: Playwright e2e config + boot smoke

**Files:**
- Create: `frontend-react/playwright.config.ts`, `frontend-react/e2e/smoke.spec.ts`
- Modify: `frontend-react/package.json`

- [ ] **Step 1: Install Playwright**

```bash
cd frontend-react && bun add -D @playwright/test && bunx playwright install chromium
```

- [ ] **Step 2: Config (reuses the dev server)**

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5174' },
  webServer: { command: 'bun run dev', url: 'http://localhost:5174', reuseExistingServer: true }
})
```

- [ ] **Step 3: Smoke spec**

`e2e/smoke.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
test('app boots and renders home', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('home')).toBeVisible()
})
```

- [ ] **Step 4: Run it**

Add script `"test:e2e": "playwright test"`. Run: `bun run test:e2e`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test(react): playwright e2e config + boot smoke"
```

---

## PHASE 1 — Core infrastructure (no features)

### Task 6: Port the API client

**Files:**
- Create: `frontend-react/src/lib/api/client.ts`, `frontend-react/src/lib/api/client.test.ts`
- Source: `frontend/src/lib/api/client.ts` (port verbatim — it is framework-agnostic)

- [ ] **Step 1: Copy the client verbatim**

Copy `frontend/src/lib/api/client.ts` to `frontend-react/src/lib/api/client.ts` unchanged. It uses only `import.meta.env.VITE_API_URL`, `fetch`, and module-level state — all valid in Vite/React. Exposes: `apiFetch`, `apiFetchData`, `setToken`, `clearToken`, `getToken`, `doRefresh`, `tryRefresh`.

- [ ] **Step 2: Write a failing test for the 401→refresh→retry path**

`src/lib/api/client.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch, clearToken } from './client'

beforeEach(() => clearToken())

describe('apiFetch', () => {
  it('refreshes on 401 then retries successfully', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))           // first call 401
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'NEW' }), { status: 200 })) // /auth/refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))            // retry
    // tryRefresh uses global fetch, so stub it too
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'NEW' }), { status: 200 })
    ))
    const out = await apiFetch<{ ok: boolean }>('/x', {}, fetchFn)
    expect(out).toEqual({ ok: true })
    vi.unstubAllGlobals()
  })

  it('throws a 401 error when refresh fails', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 })))
    await expect(apiFetch('/x', {}, fetchFn)).rejects.toMatchObject({ status: 401 })
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `bun run test src/lib/api/client.test.ts`
Expected: PASS (the ported code already implements this behavior).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(react): port framework-agnostic api client with tests"
```

### Task 7: i18n — react-i18next (lean) + migrate 613 keys

**Files:**
- Create: `frontend-react/scripts/migrate-i18n.ts`, `frontend-react/src/lib/i18n/index.ts`, `frontend-react/src/locales/{en,pt-BR}/*.json`, `frontend-react/i18next.d.ts`
- Source: `frontend/locales/{en,pt-BR}/*.json` (paraglide source JSON — already namespaced)

- [ ] **Step 1: Install react-i18next**

```bash
cd frontend-react && bun add i18next react-i18next
```

- [ ] **Step 2: Migration script — copy paraglide locale JSON into the React app**

`scripts/migrate-i18n.ts` (the paraglide source files in `frontend/locales/<lang>/<ns>.json` are already plain key→string JSON; copy them as react-i18next namespaces):
```ts
import { cpSync, mkdirSync } from 'node:fs'
const src = '../frontend/locales'
const dst = './src/locales'
mkdirSync(dst, { recursive: true })
cpSync(src, dst, { recursive: true }) // en/ and pt-BR/ with globals.json, auth.json, settings.json, etc.
console.log('i18n locales copied')
```
Run: `cd frontend-react && bun run scripts/migrate-i18n.ts`
Verify: `frontend-react/src/locales/en/globals.json` exists and contains `profile_subtitle`.

- [ ] **Step 3: i18n init (bundled resources, lean — no runtime HTTP loading)**

`src/lib/i18n/index.ts`:
```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enGlobals from '../../locales/en/globals.json'
import enAuth from '../../locales/en/auth.json'
import enSettings from '../../locales/en/settings.json'
import enIntegrations from '../../locales/en/integrations.json'
import enTenants from '../../locales/en/tenants.json'
import enAds from '../../locales/en/ads.json'
import enSocial from '../../locales/en/social-media.json'
import enPermissions from '../../locales/en/permissions.json'
// (repeat imports for pt-BR)

export const resources = {
  en: { globals: enGlobals, auth: enAuth, settings: enSettings, integrations: enIntegrations,
        tenants: enTenants, ads: enAds, 'social-media': enSocial, permissions: enPermissions }
  // 'pt-BR': { ... }
} as const

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'globals',
  interpolation: { escapeValue: false }
})
export default i18n
```

- [ ] **Step 4: Type-safe keys**

`i18next.d.ts`:
```ts
import { resources } from './src/lib/i18n'
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'globals'
    resources: (typeof resources)['en']
  }
}
```

- [ ] **Step 5: Failing test — a known key resolves**

`src/lib/i18n/i18n.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import i18n from './index'
describe('i18n', () => {
  it('resolves a known globals key', () => {
    expect(i18n.t('globals:profile_subtitle')).toBe('Manage your personal preferences')
  })
})
```
Run: `bun run test src/lib/i18n/i18n.test.ts` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(react): react-i18next (bundled, typed) + migrate 613 keys from paraglide"
```

### Task 8: Auth store → Zustand

**Files:**
- Create: `frontend-react/src/store/auth.ts`, `frontend-react/src/store/auth.test.ts`
- Source: `frontend/src/lib/stores/auth.svelte.ts` (runes → Zustand). Note: the Svelte version calls `localeStore.init(locale)`; in React this becomes `i18n.changeLanguage(locale)`.

- [ ] **Step 1: Write the Zustand store (faithful port of the runes store)**

`src/store/auth.ts`:
```ts
import { create } from 'zustand'
import { setToken as setClientToken, clearToken as clearClientToken, getToken, doRefresh, apiFetch } from '../lib/api/client'
import i18n from '../lib/i18n'

export interface AuthUser {
  id: string; name: string; email: string; tenant_id: string
  permissions: string[]; locale: string; timezone?: string
  system_role: 'user' | 'platform_admin'
}
export interface PendingTerms {
  version_id: string; version: number; locale: string
  blocks: { title: string; content: string }[]
}
interface CachedSession { user: AuthUser; token: string; expiresAt: number; pendingTerms?: PendingTerms | null }

const SESSION_KEY = 'meisterfy_session'
function loadSession(): CachedSession | null {
  try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) as CachedSession : null } catch { return null }
}
function saveSession(user: AuthUser, token: string, expiresAt: number) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, token, expiresAt })) } catch { /* private mode */ }
}
function clearSession() { try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ } }

interface AuthState {
  token: string | null
  user: AuthUser | null
  pendingTerms: PendingTerms | null
  isAuthenticated: () => boolean
  setToken: (t: string) => void
  setUser: (u: AuthUser) => void
  clear: () => void
  acceptTerms: (versionId: string) => Promise<void>
  restoreSession: () => Promise<boolean>
}

export const useAuth = create<AuthState>((set, get) => {
  function applyRefreshData(data: Record<string, unknown>) {
    const userBase = (data['user'] ?? {}) as Record<string, unknown>
    const user = {
      ...userBase,
      tenant_id: (data['tenant_id'] ?? userBase['tenant_id'] ?? '') as string,
      permissions: ((data['permissions'] ?? userBase['permissions']) as string[]) ?? [],
      system_role: (userBase['system_role'] ?? 'user') as 'user' | 'platform_admin'
    } as AuthUser
    const token = getToken()
    const pendingTerms = (data['pending_terms'] as PendingTerms | null) ?? null
    const raw = data['expires_at']
    const expiresAt = raw ? new Date(raw as string).getTime() : Date.now() + 14 * 60 * 1000
    if (token) saveSession(user, token, expiresAt)
    if (user.locale) i18n.changeLanguage(user.locale)
    set({ user, token, pendingTerms })
  }

  return {
    token: null,
    user: null,
    pendingTerms: null,
    isAuthenticated: () => get().token !== null,
    setToken: (t) => { setClientToken(t); set({ token: t }) },
    setUser: (u) => {
      const token = get().token
      if (token) saveSession(u, token, Date.now() + 14 * 60 * 1000)
      set({ user: u })
    },
    clear: () => { clearClientToken(); clearSession(); set({ token: null, user: null, pendingTerms: null }) },
    acceptTerms: async (versionId) => {
      await apiFetch('/auth/accept-terms', { method: 'POST', body: JSON.stringify({ version_id: versionId }) })
      set({ pendingTerms: null })
    },
    restoreSession: async () => {
      const cached = loadSession()
      if (cached && cached.expiresAt > Date.now()) {
        setClientToken(cached.token)
        if (cached.user.locale) i18n.changeLanguage(cached.user.locale)
        set({ token: cached.token, user: cached.user, pendingTerms: cached.pendingTerms ?? null })
        doRefresh().then((data) => { if (data) applyRefreshData(data); else get().clear() }).catch(() => {})
        return true
      }
      const data = await doRefresh()
      if (!data) return false
      applyRefreshData(data)
      return true
    }
  }
})
```

- [ ] **Step 2: Install zustand**

```bash
cd frontend-react && bun add zustand
```

- [ ] **Step 3: Failing test — setToken/clear and restore from valid cache**

`src/store/auth.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuth } from './auth'

beforeEach(() => { useAuth.getState().clear(); sessionStorage.clear() })

describe('auth store', () => {
  it('setToken makes it authenticated; clear resets', () => {
    useAuth.getState().setToken('T')
    expect(useAuth.getState().isAuthenticated()).toBe(true)
    useAuth.getState().clear()
    expect(useAuth.getState().isAuthenticated()).toBe(false)
  })

  it('restoreSession hydrates synchronously from a valid cache', async () => {
    const user = { id: '1', name: 'A', email: 'a@b.c', tenant_id: 't', permissions: [], locale: 'en', system_role: 'user' as const }
    sessionStorage.setItem('meisterfy_session', JSON.stringify({ user, token: 'T', expiresAt: Date.now() + 60000 }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))) // background refresh no-op
    const ok = await useAuth.getState().restoreSession()
    expect(ok).toBe(true)
    expect(useAuth.getState().user?.email).toBe('a@b.c')
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 4: Run the tests**

Run: `bun run test src/store/auth.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(react): port auth store from runes to zustand with tests"
```

### Task 9: App providers + protected-route guard

**Files:**
- Modify: `frontend-react/src/app.tsx`, `frontend-react/src/routes/__root.tsx`
- Create: `frontend-react/src/routes/login.tsx` (placeholder), `frontend-react/e2e/auth-guard.spec.ts`

- [ ] **Step 1: Bootstrap auth before the router renders**

In `src/app.tsx`, call `restoreSession()` once on mount and gate the first paint:
```tsx
import { useEffect, useState } from 'react'
import { useAuth } from './store/auth'
import './lib/i18n'
// inside App: run restoreSession() in useEffect, show null until it settles, then render providers
export default function App() {
  const [ready, setReady] = useState(false)
  const restore = useAuth((s) => s.restoreSession)
  useEffect(() => { restore().finally(() => setReady(true)) }, [restore])
  if (!ready) return null
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ auth: useAuth.getState() }} />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Guard placeholder protected route via beforeLoad**

Add a `login` placeholder route and protect `index` by checking auth in its `beforeLoad`:
```tsx
// src/routes/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '../store/auth'
export const Route = createFileRoute('/')({
  beforeLoad: () => { if (!useAuth.getState().isAuthenticated()) throw redirect({ to: '/login' }) },
  component: () => <div data-testid="home">home</div>
})
// src/routes/login.tsx
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/login')({
  component: () => <div data-testid="login">login</div>
})
```

- [ ] **Step 3: e2e — unauthenticated visit to "/" redirects to /login**

`e2e/auth-guard.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
test('unauthenticated user is redirected to login', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('login')).toBeVisible()
})
```
Run: `bun run test:e2e e2e/auth-guard.spec.ts` → Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(react): app providers + auth bootstrap + protected-route guard"
```

### Task 10: shadcn on Base UI + dialog primitives

**Files:**
- Create: `frontend-react/components.json`, `frontend-react/src/components/ui/*`
- Modify: `frontend-react/src/styles/app.css` (re-point dialog rules to Base UI attributes)

- [ ] **Step 1: Init shadcn (Base UI variant)**

```bash
cd frontend-react && bunx shadcn@latest init
```
Choose the Base UI style when prompted (fallback: if Base UI is unavailable/immature in the CLI at run time, init with the default Radix style and note it in the AIPIM task comment — per ADR 001 the primitive is swappable per-component).

- [ ] **Step 2: Add the primitives the app actually uses**

```bash
cd frontend-react && bunx shadcn@latest add button input label dialog select checkbox switch card alert
```
(MultiSelect and Drawer are not stock shadcn — create thin wrappers in Phase 2 when their first consumer route is ported. Do NOT pre-build them here — YAGNI.)

- [ ] **Step 3: Re-point the dialog CSS to Base UI data-attributes**

In `src/styles/app.css`, the ported rules assume bits-ui's `data-dialog-content` / `data-starting-style`. Replace the selectors with the equivalents emitted by the chosen primitive (verify the actual attribute by inspecting the rendered DOM — e.g. Radix emits `[data-state="open"]` on `[role="dialog"]`; Base UI emits its own). Keep the centering contract: the content element must be centered by exactly ONE mechanism (the global `transform: translate(-50%,-50%)`), never combined with a Tailwind `-translate-x/y` utility. (This is the exact class of bug fixed on 2026-06-09 in the Svelte app.)

- [ ] **Step 4: Render test — a dialog opens centered**

`src/components/ui/dialog.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
// import the generated Dialog parts and render an open dialog; assert the content node is in the document
// (exact import path depends on the shadcn output; assert getByRole('dialog') is visible)
import { Dialog, DialogContent, DialogTrigger } from './dialog'
describe('dialog', () => {
  it('renders content when open', async () => {
    render(<Dialog open><DialogContent>hi</DialogContent></Dialog>)
    expect(await screen.findByText('hi')).toBeInTheDocument()
  })
})
```
Run: `bun run test src/components/ui/dialog.test.tsx` → Expected: PASS (adjust the import/props to the generated component's actual API).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(react): shadcn ui primitives on base-ui + ported dialog styles"
```

---

## Definition of Done (Phase 0/1)

- `frontend-react/` boots on `:5174`, separate from the live Svelte app.
- `bun run test` (Vitest) and `bun run test:e2e` (Playwright) both green.
- API client, auth store (Zustand), i18n (613 keys, typed), and the ~10 shadcn primitives exist and are tested.
- No product routes yet — that is Phase 2 (the proof slice: login + integrations[modal] + one `$effect`-heavy route), which is a separate plan and the calibration stop.

## Self-review notes

- **Spec coverage:** Phase 0 (scaffold) and Phase 1 (core infra) of ADR 001 are each covered by Tasks 1–5 and 6–10 respectively. Cutover, proof slice, and per-route porting are explicitly out of scope (later phases/plans).
- **Type consistency:** `AuthUser`/`PendingTerms` shapes in Task 8 match the Svelte source verbatim. `apiFetch`/`apiFetchData`/`doRefresh`/`getToken`/`setToken` signatures in Task 6 match what Task 8 imports.
- **Known runtime unknown:** shadcn's Base UI maturity (Task 10) is the one thing to confirm at execution time; the ADR's per-component Radix fallback covers it.
