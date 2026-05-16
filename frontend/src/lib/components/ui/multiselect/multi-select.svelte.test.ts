import { render } from 'vitest-browser-svelte'
import { expect, test, vi } from 'vitest'

vi.mock('bits-ui', async () => {
	const passthrough = (await import('../../social/__test-mocks__/passthrough.svelte')).default
	return {
		Popover: {
			Root: passthrough,
			Trigger: passthrough,
			Content: passthrough
		}
	}
})

import MultiSelect from './multi-select.svelte'

const options = [
	{ value: 'a', label: 'Alpha' },
	{ value: 'b', label: 'Beta' },
	{ value: 'c', label: 'Gamma' }
]

test('shows placeholder when no value selected', async () => {
	const screen = await render(MultiSelect, { options, value: [] })
	await expect.element(screen.getByText('Select…')).toBeVisible()
})

test('shows custom placeholder', async () => {
	const screen = await render(MultiSelect, { options, value: [], placeholder: 'Pick items' })
	await expect.element(screen.getByText('Pick items')).toBeVisible()
})

test('hides placeholder when value is provided', async () => {
	const screen = await render(MultiSelect, { options, value: ['a'] })
	await expect.element(screen.getByPlaceholder('Search…')).toBeVisible()
	expect(screen.getByText('Select…').elements()).toHaveLength(0)
})

test('hides placeholder when multiple values provided', async () => {
	const screen = await render(MultiSelect, { options, value: ['a', 'b'] })
	await expect.element(screen.getByPlaceholder('Search…')).toBeVisible()
	expect(screen.getByText('Select…').elements()).toHaveLength(0)
})

test('all options are listed in dropdown', async () => {
	const screen = await render(MultiSelect, { options, value: [] })
	await expect.element(screen.getByRole('button', { name: /Alpha/i })).toBeVisible()
	await expect.element(screen.getByRole('button', { name: /Beta/i })).toBeVisible()
	await expect.element(screen.getByRole('button', { name: /Gamma/i })).toBeVisible()
})

test('clicking an option calls onchange with its value', async () => {
	const onchange = vi.fn()
	const screen = await render(MultiSelect, { options, value: [], onchange })
	await screen.getByRole('button', { name: /Alpha/i }).click()
	expect(onchange).toHaveBeenCalledWith(['a'])
})

test('clicking a selected option calls onchange removing it', async () => {
	const onchange = vi.fn()
	const screen = await render(MultiSelect, { options, value: ['a'], onchange })
	await screen.getByRole('button', { name: /Alpha/i }).click()
	expect(onchange).toHaveBeenCalledWith([])
})

test('filtering by search shows only matching options', async () => {
	const screen = await render(MultiSelect, { options, value: [] })
	await screen.getByPlaceholder('Search…').fill('alp')
	await expect.element(screen.getByRole('button', { name: /Alpha/i })).toBeVisible()
	expect(screen.getByRole('button', { name: /Beta/i }).elements()).toHaveLength(0)
})

test('shows no options message when search has no match', async () => {
	const screen = await render(MultiSelect, { options, value: [] })
	await screen.getByPlaceholder('Search…').fill('zzz')
	await expect.element(screen.getByText('No options found')).toBeVisible()
})
