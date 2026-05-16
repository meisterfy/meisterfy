import { render } from 'vitest-browser-svelte'
import { expect, test, vi } from 'vitest'
import CardConnected from './card-connected.svelte'
import type { Integration, ProviderSchema } from '$lib/api/integrations'

const provider: ProviderSchema = {
	provider: 'google_ads',
	group: 'advertising',
	display_name: 'Google Ads',
	description: 'Connect to Google Ads',
	logo_svg: '',
	logo_png: '',
	config_fields: [],
	credential_fields: [],
	oauth_flow: true,
	oauth_start_path: '/oauth/google-ads'
}

const connectedIntegration: Integration = {
	id: 'int-1',
	name: 'Main Google Ads',
	provider: 'google_ads',
	group: 'advertising',
	status: 'connected',
	error_message: null,
	tenant_ids: [],
	config: {},
	has_credentials: true,
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z'
}

const pendingIntegration: Integration = {
	...connectedIntegration,
	id: 'int-2',
	status: 'pending'
}

const errorIntegration: Integration = {
	...connectedIntegration,
	id: 'int-3',
	status: 'error',
	error_message: 'Token expired'
}

test('shows provider display name', async () => {
	const screen = await render(CardConnected, {
		integration: connectedIntegration,
		provider,
		onEdit: vi.fn(),
		onDelete: vi.fn()
	})
	await expect.element(screen.getByRole('heading', { name: 'Google Ads' })).toBeVisible()
})

test('shows integration name', async () => {
	const screen = await render(CardConnected, {
		integration: connectedIntegration,
		provider,
		onEdit: vi.fn(),
		onDelete: vi.fn()
	})
	await expect.element(screen.getByText('Main Google Ads')).toBeVisible()
})

test('connected status shows Re-auth link when oauth configured', async () => {
	const screen = await render(CardConnected, {
		integration: connectedIntegration,
		provider,
		onEdit: vi.fn(),
		onDelete: vi.fn()
	})
	await expect.element(screen.getByText('Re-auth')).toBeVisible()
})

test('pending status shows Connect link when oauth configured', async () => {
	const screen = await render(CardConnected, {
		integration: pendingIntegration,
		provider,
		onEdit: vi.fn(),
		onDelete: vi.fn()
	})
	await expect.element(screen.getByText('Connect')).toBeVisible()
})

test('edit button is visible', async () => {
	const screen = await render(CardConnected, {
		integration: connectedIntegration,
		provider,
		onEdit: vi.fn(),
		onDelete: vi.fn()
	})
	await expect.element(screen.getByTitle('Edit')).toBeVisible()
})

test('delete button is visible', async () => {
	const screen = await render(CardConnected, {
		integration: connectedIntegration,
		provider,
		onEdit: vi.fn(),
		onDelete: vi.fn()
	})
	await expect.element(screen.getByTitle('Delete')).toBeVisible()
})

test('clicking edit calls onEdit', async () => {
	const onEdit = vi.fn()
	const screen = await render(CardConnected, {
		integration: connectedIntegration,
		provider,
		onEdit,
		onDelete: vi.fn()
	})
	await screen.getByTitle('Edit').click()
	expect(onEdit).toHaveBeenCalledOnce()
})

test('clicking delete calls onDelete', async () => {
	const onDelete = vi.fn()
	const screen = await render(CardConnected, {
		integration: connectedIntegration,
		provider,
		onEdit: vi.fn(),
		onDelete
	})
	await screen.getByTitle('Delete').click()
	expect(onDelete).toHaveBeenCalledOnce()
})

test('error message visible when status is error', async () => {
	const screen = await render(CardConnected, {
		integration: errorIntegration,
		provider,
		onEdit: vi.fn(),
		onDelete: vi.fn()
	})
	await expect.element(screen.getByText('Token expired')).toBeVisible()
})

test('shows tenant label badge when tenant_ids is populated', async () => {
	const screen = await render(CardConnected, {
		integration: { ...connectedIntegration, tenant_ids: ['t1'] },
		provider,
		tenantOptions: [{ value: 't1', label: 'Acme Corp' }],
		onEdit: vi.fn(),
		onDelete: vi.fn()
	})
	await expect.element(screen.getByText('Acme Corp')).toBeVisible()
})
