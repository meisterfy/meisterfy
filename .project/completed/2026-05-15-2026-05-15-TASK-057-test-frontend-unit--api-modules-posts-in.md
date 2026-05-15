---
title: "test: frontend unit — API modules (posts, integrations, campaigns, tenants, users) + coverage config"
created: 2026-05-15T14:35:02.909Z
priority: P2-M
status: backlog
tags: [test]
---

# test: frontend unit — API modules (posts, integrations, campaigns, tenants, users) + coverage config

## Context
The frontend has 12 API modules in `src/lib/api/` but only `ai.ts` has tests. These modules encode the HTTP contract between frontend and backend: endpoint paths, request shapes, response parsing, error handling. Regressions here break the UI silently.

Also: 2 scaffold test files (`greet.spec.ts`, `welcome.svelte.spec.ts`) inflate the test count without covering real code and must be removed.

## Files to create
- `src/lib/api/posts.spec.ts`
- `src/lib/api/integrations.spec.ts`
- `src/lib/api/campaigns.spec.ts`
- `src/lib/api/tenants.spec.ts`
- `src/lib/api/users.spec.ts`
- `src/lib/api/client.spec.ts`

## Files to delete
- `src/lib/vitest-examples/greet.spec.ts`
- `src/lib/vitest-examples/welcome.svelte.spec.ts`
- `src/lib/vitest-examples/greet.ts`
- `src/lib/vitest-examples/welcome.svelte`
  (only if these files exist only for the scaffold — check before deleting)

## Files to update
- `vite.config.ts` — add coverage config (see TASK-056 for the snippet)
- `package.json` — add `@vitest/coverage-v8` dev dependency if not present

---

## Pattern (follow `ai.spec.ts` as model)
All API tests are in the `server` vitest project (node environment, no browser):

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { listPosts, createPost, updatePost, deletePost } from './posts'

function mockFetch(response: Partial<Response>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, ...response }))
}

afterEach(() => vi.restoreAllMocks())
```

---

## `posts.spec.ts`
```typescript
describe('listPosts', () => {
  it('calls correct endpoint with tenant and status filter', async () => { ... })
  it('returns parsed post array', async () => { ... })
  it('throws on non-ok response', async () => { ... })
})

describe('createPost', () => {
  it('sends POST with correct body', async () => { ... })
  it('returns created post', async () => { ... })
  it('throws on 422', async () => { ... })
})

describe('updatePost', () => { ... })
describe('deletePost', () => { ... })
```

---

## `integrations.spec.ts`
```typescript
describe('listIntegrations', () => { ... })
describe('getIntegration', () => { ... })
describe('createIntegration', () => { ... })
describe('updateIntegration', () => {
  it('sends updated fields', async () => { ... })
  it('handles setTenants correctly', async () => { ... })
})
describe('deleteIntegration', () => { ... })
```

---

## `campaigns.spec.ts`
```typescript
describe('listCampaigns', () => { ... })
describe('getCampaign', () => { ... })
describe('updateCampaignBudget', () => { ... })
describe('setCampaignStatus', () => { ... })
```

---

## `tenants.spec.ts`
```typescript
describe('listTenants', () => { ... })
describe('getTenant', () => { ... })
describe('createTenant', () => { ... })
describe('updateTenant', () => { ... })
```

---

## `users.spec.ts`
```typescript
describe('listUsers', () => { ... })
describe('createUser', () => { ... })
describe('assignRole', () => { ... })
describe('deactivateUser', () => { ... })
```

---

## `client.spec.ts`
The base HTTP client (`src/lib/api/client.ts`) likely wraps fetch with auth headers. Test:
```typescript
describe('apiClient', () => {
  it('attaches Authorization header when token present', async () => { ... })
  it('throws ApiError with status and message on non-ok', async () => { ... })
  it('handles 401 by triggering auth refresh or redirect', async () => { ... })
})
```

---

## Coverage config update for `vite.config.ts`
Add inside the `test:` object (top-level, outside `projects:`):
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/lib/**'],
  exclude: [
    'src/lib/paraglide/**',
    'src/lib/vitest-examples/**',
    'src/lib/**/*.d.ts',
  ],
  thresholds: {
    lines: 30,
    functions: 30,
  }
}
```

Run coverage: `bun run test:unit -- --run --coverage`

## Acceptance criteria
- `bun run test:unit -- --run` passes with all new tests
- Scaffold files removed — no test for `greet()` or `welcome.svelte`
- Each API module: at least one happy-path and one error-path test per exported function
- `src/lib/api/` coverage: >70%
- Coverage report generated in `frontend/coverage/` (for CI upload in TASK-056)

## Dependencies
- None (pure unit tests with fetch mocks)
- TASK-056 creates the CI step that uses the coverage output — coordinate the output path


