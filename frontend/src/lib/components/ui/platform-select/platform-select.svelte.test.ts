import { render } from 'vitest-browser-svelte'
import { expect, test } from 'vitest'
import PlatformSelect from './platform-select.svelte'

test('shows placeholder when no platforms selected', async () => {
  const screen = await render(PlatformSelect, { value: [] })
  await expect.element(screen.getByText('Select platforms…')).toBeVisible()
})

test('shows custom placeholder', async () => {
  const screen = await render(PlatformSelect, { value: [], placeholder: 'Pick a platform' })
  await expect.element(screen.getByText('Pick a platform')).toBeVisible()
})

test('shows chip label for pre-selected platform', async () => {
  const screen = await render(PlatformSelect, { value: ['linkedin'] })
  await expect.element(screen.getByText('LinkedIn')).toBeVisible()
})

test('shows multiple chips when multiple platforms pre-selected', async () => {
  const screen = await render(PlatformSelect, { value: ['linkedin', 'facebook'] })
  await expect.element(screen.getByText('LinkedIn')).toBeVisible()
  await expect.element(screen.getByText('Facebook')).toBeVisible()
})

test('chip has remove button with accessible label', async () => {
  const screen = await render(PlatformSelect, { value: ['linkedin'] })
  await expect.element(screen.getByRole('button', { name: 'Remove LinkedIn', exact: true })).toBeVisible()
})

test('clicking remove button deselects the platform', async () => {
  const screen = await render(PlatformSelect, { value: ['linkedin'] })
  await screen.getByRole('button', { name: 'Remove LinkedIn', exact: true }).click()
  await expect.element(screen.getByText('Select platforms…')).toBeVisible()
})

test('clicking trigger opens dropdown with platform options', async () => {
  const screen = await render(PlatformSelect, { value: [] })
  await screen.getByRole('button').click()
  await expect.element(screen.getByText('LinkedIn')).toBeVisible()
})

test('clicking a platform in dropdown adds its chip', async () => {
  const screen = await render(PlatformSelect, { value: [] })
  await screen.getByRole('button').click()
  await screen.getByRole('button', { name: 'Facebook', exact: true }).click()
  await expect.element(screen.getByRole('button', { name: 'Remove Facebook', exact: true })).toBeVisible()
})
