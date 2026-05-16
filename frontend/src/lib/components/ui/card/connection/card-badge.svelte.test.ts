import { render } from 'vitest-browser-svelte'
import { expect, test } from 'vitest'
import CardBadge from './card-badge.svelte'

test('renders label text', async () => {
	const screen = await render(CardBadge, { label: 'Connected' })
	await expect.element(screen.getByText('Connected')).toBeVisible()
})

test('default variant applies slate background', async () => {
	const screen = await render(CardBadge, { label: 'Status', variant: 'default' })
	await expect.element(screen.getByText('Status')).toHaveClass('bg-slate-100')
})

test('success variant applies emerald background', async () => {
	const screen = await render(CardBadge, { label: 'OK', variant: 'success' })
	await expect.element(screen.getByText('OK')).toHaveClass('bg-emerald-50')
})

test('warning variant applies amber background', async () => {
	const screen = await render(CardBadge, { label: 'Warn', variant: 'warning' })
	await expect.element(screen.getByText('Warn')).toHaveClass('bg-amber-50')
})

test('error variant applies red background', async () => {
	const screen = await render(CardBadge, { label: 'Error', variant: 'error' })
	await expect.element(screen.getByText('Error')).toHaveClass('bg-red-50')
})

test('info variant applies blue background', async () => {
	const screen = await render(CardBadge, { label: 'Info', variant: 'info' })
	await expect.element(screen.getByText('Info')).toHaveClass('bg-blue-50')
})

test('error variant applies red text color', async () => {
	const screen = await render(CardBadge, { label: 'Fail', variant: 'error' })
	await expect.element(screen.getByText('Fail')).toHaveClass('text-red-700')
})
