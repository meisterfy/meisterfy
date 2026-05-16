import { render } from 'vitest-browser-svelte'
import { expect, test } from 'vitest'
import StatusBadge from './status-badge.svelte'

test('renders draft status text with slate classes', async () => {
	const screen = await render(StatusBadge, { status: 'draft' })
	const badge = screen.getByText('draft')
	await expect.element(badge).toBeVisible()
	await expect.element(badge).toHaveClass('bg-slate-100')
	await expect.element(badge).toHaveClass('text-slate-600')
})

test('renders approved status text with emerald classes', async () => {
	const screen = await render(StatusBadge, { status: 'approved' })
	const badge = screen.getByText('approved')
	await expect.element(badge).toBeVisible()
	await expect.element(badge).toHaveClass('bg-emerald-100')
	await expect.element(badge).toHaveClass('text-emerald-700')
})

test('renders scheduled status text with indigo classes', async () => {
	const screen = await render(StatusBadge, { status: 'scheduled' })
	const badge = screen.getByText('scheduled')
	await expect.element(badge).toBeVisible()
	await expect.element(badge).toHaveClass('bg-indigo-100')
	await expect.element(badge).toHaveClass('text-indigo-700')
})

test('renders published status text with emerald classes', async () => {
	const screen = await render(StatusBadge, { status: 'published' })
	const badge = screen.getByText('published')
	await expect.element(badge).toBeVisible()
	await expect.element(badge).toHaveClass('bg-emerald-100')
	await expect.element(badge).toHaveClass('text-emerald-700')
})

test('falls back to slate classes for unknown status', async () => {
	const screen = await render(StatusBadge, { status: 'unknown' })
	const badge = screen.getByText('unknown')
	await expect.element(badge).toBeVisible()
	await expect.element(badge).toHaveClass('bg-slate-100')
	await expect.element(badge).toHaveClass('text-slate-600')
})
