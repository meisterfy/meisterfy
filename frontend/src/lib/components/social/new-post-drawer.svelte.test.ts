import { render } from 'vitest-browser-svelte'
import { expect, test, vi } from 'vitest'

vi.mock('$lib/components/ui/drawer/drawer.svelte', async () => ({
  default: (await import('./__test-mocks__/passthrough.svelte')).default
}))

vi.mock('@/lib/components/ui/platform-select/platform-select.svelte', async () => ({
  default: (await import('./__test-mocks__/platform-select.svelte')).default
}))

import NewPostDrawer from './new-post-drawer.svelte'

test('submit button is disabled when title is empty', async () => {
  const screen = await render(NewPostDrawer, {
    open: true,
    tenant: 'acme',
    defaultDate: '2026-05-09',
    onCreated: () => {}
  })
  const btn = screen.getByRole('button', { name: /Add to Planner/i })
  await expect.element(btn).toBeDisabled()
})

test('submit button is disabled when content is empty', async () => {
  const screen = await render(NewPostDrawer, {
    open: true,
    tenant: 'acme',
    defaultDate: '2026-05-09',
    onCreated: () => {}
  })
  await screen.getByPlaceholder('Post title').fill('My title')
  const btn = screen.getByRole('button', { name: /Add to Planner/i })
  await expect.element(btn).toBeDisabled()
})

test('submit button is enabled when title and content are filled', async () => {
  const screen = await render(NewPostDrawer, {
    open: true,
    tenant: 'acme',
    defaultDate: '2026-05-09',
    onCreated: () => {}
  })
  await screen.getByPlaceholder('Post title').fill('My title')
  await screen.getByPlaceholder('Post copy…').fill('Post body text')
  const btn = screen.getByRole('button', { name: /Add to Planner/i })
  await expect.element(btn).not.toBeDisabled()
})

test('shows defaultDate in drawer header', async () => {
  const screen = await render(NewPostDrawer, {
    open: true,
    tenant: 'acme',
    defaultDate: '2026-05-09',
    onCreated: () => {}
  })
  await expect.element(screen.getByText('2026-05-09')).toBeVisible()
})
