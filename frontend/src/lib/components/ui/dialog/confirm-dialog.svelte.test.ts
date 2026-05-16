import { render } from 'vitest-browser-svelte'
import { expect, test, vi } from 'vitest'

vi.mock('bits-ui', async () => {
	const passthrough = (await import('../../social/__test-mocks__/passthrough.svelte')).default
	return {
		Dialog: {
			Root: passthrough,
			Portal: passthrough,
			Overlay: passthrough,
			Content: passthrough,
			Title: passthrough,
			Description: passthrough,
			Close: passthrough
		}
	}
})

import ConfirmDialog from './confirm-dialog.svelte'

test('shows custom title', async () => {
	const screen = await render(ConfirmDialog, {
		open: true,
		title: 'Delete Item',
		onconfirm: vi.fn()
	})
	await expect.element(screen.getByText('Delete Item')).toBeVisible()
})

test('shows custom description', async () => {
	const screen = await render(ConfirmDialog, {
		open: true,
		description: 'This action cannot be undone.',
		onconfirm: vi.fn()
	})
	await expect.element(screen.getByText('This action cannot be undone.')).toBeVisible()
})

test('shows custom confirm label on button', async () => {
	const screen = await render(ConfirmDialog, {
		open: true,
		confirmLabel: 'Remove',
		onconfirm: vi.fn()
	})
	await expect.element(screen.getByRole('button', { name: 'Remove' })).toBeVisible()
})

test('shows cancel label text', async () => {
	const screen = await render(ConfirmDialog, {
		open: true,
		cancelLabel: 'Go Back',
		onconfirm: vi.fn()
	})
	await expect.element(screen.getByText('Go Back')).toBeVisible()
})

test('clicking confirm button calls onconfirm', async () => {
	const onconfirm = vi.fn()
	const screen = await render(ConfirmDialog, {
		open: true,
		confirmLabel: 'Delete',
		onconfirm
	})
	await screen.getByRole('button', { name: 'Delete' }).click()
	expect(onconfirm).toHaveBeenCalledOnce()
})

test('confirm button is disabled when isLoading', async () => {
	const screen = await render(ConfirmDialog, {
		open: true,
		isLoading: true,
		onconfirm: vi.fn()
	})
	await expect.element(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
})

test('shows loading text on confirm button when isLoading', async () => {
	const screen = await render(ConfirmDialog, {
		open: true,
		isLoading: true,
		confirmLabel: 'Delete',
		onconfirm: vi.fn()
	})
	await expect.element(screen.getByText('Deleting…')).toBeVisible()
})
