import { render } from 'vitest-browser-svelte'
import { expect, test, vi } from 'vitest'
import CardAdd from './card-add.svelte'
import type { ProviderSchema } from '$lib/api/integrations'

const provider: ProviderSchema = {
  provider: 'openai',
  group: 'ai_providers',
  display_name: 'OpenAI',
  description: 'Connect to OpenAI GPT models',
  logo_svg: '',
  logo_png: '',
  config_fields: [],
  credential_fields: [],
  oauth_flow: false
}

test('shows provider display name', async () => {
  const screen = await render(CardAdd, { provider, onclick: vi.fn() })
  await expect.element(screen.getByRole('heading', { name: 'OpenAI' })).toBeVisible()
})

test('shows provider description', async () => {
  const screen = await render(CardAdd, { provider, onclick: vi.fn() })
  await expect.element(screen.getByText('Connect to OpenAI GPT models')).toBeVisible()
})

test('shows Add Connection button', async () => {
  const screen = await render(CardAdd, { provider, onclick: vi.fn() })
  await expect.element(screen.getByText('Add Connection')).toBeVisible()
})

test('clicking Add Connection calls onclick', async () => {
  const onclick = vi.fn()
  const screen = await render(CardAdd, { provider, onclick })
  await screen.getByText('Add Connection').click()
  expect(onclick).toHaveBeenCalledOnce()
})

test('shows group tag', async () => {
  const screen = await render(CardAdd, { provider, onclick: vi.fn() })
  await expect.element(screen.getByText(/#ai-providers/i)).toBeVisible()
})
