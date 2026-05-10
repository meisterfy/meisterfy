import { render } from 'vitest-browser-svelte'
import { expect, test, vi } from 'vitest'

vi.mock('$lib/components/ui/drawer/drawer.svelte', async () => ({
  default: (await import('./__test-mocks__/passthrough.svelte')).default
}))

vi.mock('@/lib/components/ui/platform-select/platform-select.svelte', async () => ({
  default: (await import('./__test-mocks__/platform-select.svelte')).default
}))

vi.mock('$lib/components/ui/dialog/confirm-dialog.svelte', async () => ({
  default: (await import('./__test-mocks__/passthrough.svelte')).default
}))

vi.mock('$lib/components/ui/status-badge/status-badge.svelte', async () => ({
  default: (await import('./__test-mocks__/passthrough.svelte')).default
}))

vi.mock('@/lib/components/ui/provider-icon.svelte', async () => ({
  default: (await import('./__test-mocks__/passthrough.svelte')).default
}))

import EditPostDrawer from './edit-post-drawer.svelte'
import type { PostShape } from '$lib/social'

const published: PostShape = {
  id: 'p1',
  status: 'published',
  title: 'Published Title',
  content: 'Published content body',
  hashtags: ['hello'],
  platform: 'instagram_feed',
  client_id: 'acme',
  media_files: [],
  workflow: null
}

const draft: PostShape = {
  id: 'p2',
  status: 'draft',
  title: 'Draft Title',
  content: 'Draft content body',
  hashtags: [],
  platform: 'facebook',
  client_id: 'acme',
  media_files: [],
  workflow: null
}

test('shows read-only title for published posts (no Save Changes button)', async () => {
  const screen = await render(EditPostDrawer, {
    open: true,
    post: published,
    tenant: 'acme',
    onSaved: () => {},
    onDeleted: () => {}
  })
  await expect.element(screen.getByText('Published Title')).toBeVisible()
  expect(screen.getByRole('button', { name: /Save Changes/i }).elements()).toHaveLength(0)
})

test('shows Save Changes button for draft posts', async () => {
  const screen = await render(EditPostDrawer, {
    open: true,
    post: draft,
    tenant: 'acme',
    onSaved: () => {},
    onDeleted: () => {}
  })
  await expect.element(screen.getByRole('button', { name: /Save Changes/i })).toBeVisible()
})

test('hides Delete button for published posts', async () => {
  const screen = await render(EditPostDrawer, {
    open: true,
    post: published,
    tenant: 'acme',
    onSaved: () => {},
    onDeleted: () => {}
  })
  expect(screen.getByRole('button', { name: /Delete/i }).elements()).toHaveLength(0)
})

test('shows Delete button for non-published posts', async () => {
  const screen = await render(EditPostDrawer, {
    open: true,
    post: draft,
    tenant: 'acme',
    onSaved: () => {},
    onDeleted: () => {}
  })
  await expect.element(screen.getByRole('button', { name: /Delete/i })).toBeVisible()
})

test('Save Changes is disabled when title is cleared', async () => {
  const screen = await render(EditPostDrawer, {
    open: true,
    post: draft,
    tenant: 'acme',
    onSaved: () => {},
    onDeleted: () => {}
  })
  await screen.getByRole('textbox', { name: 'Title' }).fill('')
  await expect.element(screen.getByRole('button', { name: /Save Changes/i })).toBeDisabled()
})
