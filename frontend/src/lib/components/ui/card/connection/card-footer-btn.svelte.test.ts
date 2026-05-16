import { render } from 'vitest-browser-svelte'
import { expect, test, vi } from 'vitest'
import CardFooterBtn from './card-footer-btn.svelte'

test('renders an anchor when href is provided', async () => {
	const screen = await render(CardFooterBtn, { href: '/some/path', label: 'Go' })
	const link = screen.getByRole('link', { name: 'Go' })
	await expect.element(link).toBeVisible()
	await expect.element(link).toHaveAttribute('href', '/some/path')
})

test('renders a button when onclick is provided', async () => {
	const screen = await render(CardFooterBtn, { onclick: vi.fn(), label: 'Click me' })
	await expect.element(screen.getByRole('button', { name: 'Click me' })).toBeVisible()
})

test('clicking button calls onclick', async () => {
	const onclick = vi.fn()
	const screen = await render(CardFooterBtn, { onclick, label: 'Do it' })
	await screen.getByRole('button', { name: 'Do it' }).click()
	expect(onclick).toHaveBeenCalledOnce()
})

test('shows label text', async () => {
	const screen = await render(CardFooterBtn, { onclick: vi.fn(), label: 'Save Changes' })
	await expect.element(screen.getByText('Save Changes')).toBeVisible()
})

test('title attribute applied to button', async () => {
	const screen = await render(CardFooterBtn, { onclick: vi.fn(), title: 'My Tooltip' })
	await expect.element(screen.getByTitle('My Tooltip')).toBeVisible()
})

test('danger variant applies red border class', async () => {
	const screen = await render(CardFooterBtn, {
		onclick: vi.fn(),
		label: 'Remove',
		variant: 'danger'
	})
	await expect
		.element(screen.getByRole('button', { name: 'Remove' }))
		.toHaveClass('border-red-400/30')
})

test('primary variant applies primary background class', async () => {
	const screen = await render(CardFooterBtn, {
		onclick: vi.fn(),
		label: 'Connect',
		variant: 'primary'
	})
	await expect
		.element(screen.getByRole('button', { name: 'Connect' }))
		.toHaveClass('bg-slate-500/10')
})
