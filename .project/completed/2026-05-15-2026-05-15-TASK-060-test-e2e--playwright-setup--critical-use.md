---
title: "test: e2e — Playwright setup + critical user flows (login, post creation, integration connect)"
created: 2026-05-15T14:36:19.526Z
priority: P3
status: backlog
tags: [test]
---

# test: e2e — Playwright setup + critical user flows (login, post creation, integration connect)

## Context
E2E tests validate complete user flows against a real running stack (backend + frontend + database). They are the last line of defense for regressions in critical user journeys. These tests are slow by nature (10–60s each), so they cover only the golden paths and are NOT run on every PR — only on main branch merges or manually triggered.

## Tech stack
- Playwright (already installed as `playwright` and `@vitest/browser-playwright` in package.json)
- Use Playwright's standalone test runner (`@playwright/test`), NOT vitest — this allows `page`, `request` fixtures and proper trace/screenshot on failure
- Tests live in `frontend/e2e/` directory

## Setup

### Install `@playwright/test`
```bash
cd frontend && bun add -D @playwright/test
```

### Create `frontend/playwright.config.ts`
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Start backend + frontend before tests:
  // webServer is optional if running manually with `make dev/bundle`
})
```

### `Makefile` addition
```makefile
test/e2e:
	cd frontend && bunx playwright test

test/e2e/ui:
	cd frontend && bunx playwright test --ui

test/e2e/report:
	cd frontend && bunx playwright show-report
```

---

## Test files to create

### `frontend/e2e/auth.spec.ts` — Login flow
```typescript
test('login with valid credentials redirects to dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!)
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
  await page.getByRole('button', { name: /Sign in/i }).click()
  await expect(page).toHaveURL(/\/dashboard|\//)
})

test('login with wrong password shows error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('user@test.com')
  await page.getByLabel('Password').fill('wrongpassword')
  await page.getByRole('button', { name: /Sign in/i }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL('/login') // stays on login
})

test('accessing protected route without login redirects to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
})
```

### `frontend/e2e/social.spec.ts` — Post creation and management
```typescript
// Requires authenticated state — use Playwright's storageState for auth reuse

test.beforeAll(async ({ browser }) => {
  // login once, save auth state to file
})

test.use({ storageState: 'e2e/.auth/user.json' })

test('create a new post in the planner', async ({ page }) => {
  await page.goto('/social/planner')
  await page.getByRole('button', { name: /New Post|Add Post/i }).click()
  await page.getByPlaceholder('Post title').fill('E2E Test Post')
  await page.getByPlaceholder('Post copy').fill('This is an automated e2e test post')
  await page.getByRole('button', { name: /Add to Planner/i }).click()
  await expect(page.getByText('E2E Test Post')).toBeVisible()
})

test('edit a draft post', async ({ page }) => { ... })
test('delete a post shows confirmation dialog', async ({ page }) => { ... })
```

### `frontend/e2e/setup.spec.ts` — First-time setup flow (run against a fresh DB)
```typescript
// Only meaningful against a blank database — mark as serial and run in isolation
test.describe.configure({ mode: 'serial' })

test('setup wizard creates first user and redirects to login', async ({ page }) => {
  await page.goto('/setup')
  await page.getByLabel('Email').fill('admin@test.com')
  await page.getByLabel('Password').fill('SecurePassword123!')
  await page.getByRole('button', { name: /Create Account|Setup/i }).click()
  await expect(page).toHaveURL('/login')
})

test('setup page locked after first user', async ({ page }) => {
  await page.goto('/setup')
  await expect(page).not.toHaveURL('/setup') // redirected away
})
```

---

## CI integration
Add a separate workflow file: `.github/workflows/e2e.yml`
```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  workflow_dispatch:           # manual trigger

jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        ...
    steps:
      - ... (checkout, setup go, setup bun)
      - name: Start backend
        run: cd backend && go run ./cmd/server &
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/testdb?sslmode=disable
          JWT_SECRET: e2e-test-secret
          PORT: 8181
      - name: Build & start frontend
        run: cd frontend && bun run build && bunx serve -s build -l 5173 &
      - name: Install Playwright
        run: cd frontend && bunx playwright install chromium --with-deps
      - name: Run E2E tests
        run: cd frontend && bunx playwright test
        env:
          E2E_BASE_URL: http://localhost:5173
          E2E_USER_EMAIL: admin@test.com
          E2E_USER_PASSWORD: SecurePassword123!
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

---

## Acceptance criteria
- `cd frontend && bunx playwright test` passes against local running stack (`make dev/bundle`)
- Auth flow (login success + login failure + protected route redirect) fully covered
- Post creation golden path covered
- Tests use `storageState` for auth reuse — no login in every test
- Traces and screenshots saved on failure
- E2E workflow runs on push to main (not on PRs — too slow)

## Dependencies
- TASK-056 (CI infrastructure exists)
- Requires a running backend + frontend — NOT a mock environment
- E2E credentials must be configured as GitHub Secrets: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`


