import { render } from 'vitest-browser-svelte'
import { expect, test } from 'vitest'
import BrandIcon from './brand-icon.svelte'

test('shows first letter for single-word name', async () => {
  const screen = await render(BrandIcon, { name: 'Alice' })
  await expect.element(screen.getByText('A')).toBeVisible()
})

test('shows initials for two-word name', async () => {
  const screen = await render(BrandIcon, { name: 'Alice Bob' })
  await expect.element(screen.getByText('AB')).toBeVisible()
})

test('uses only first two words for longer names', async () => {
  const screen = await render(BrandIcon, { name: 'Alice Bob Carol' })
  await expect.element(screen.getByText('AB')).toBeVisible()
})

test('uppercases initials from lowercase name', async () => {
  const screen = await render(BrandIcon, { name: 'alice bob' })
  await expect.element(screen.getByText('AB')).toBeVisible()
})

test('sm size applies h-6 w-6 classes', async () => {
  const screen = await render(BrandIcon, { name: 'Test', size: 'sm' })
  await expect.element(screen.getByText('T')).toHaveClass('h-6')
  await expect.element(screen.getByText('T')).toHaveClass('w-6')
})

test('default size applies h-8 w-8 classes', async () => {
  const screen = await render(BrandIcon, { name: 'Test' })
  await expect.element(screen.getByText('T')).toHaveClass('h-8')
  await expect.element(screen.getByText('T')).toHaveClass('w-8')
})
