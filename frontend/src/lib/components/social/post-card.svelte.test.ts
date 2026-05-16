import { render } from 'vitest-browser-svelte'
import { expect, test, vi } from 'vitest'
import PostCard from './post-card.svelte'
import type { Post } from '$lib/api/posts'

const base: Post & { filename: string; media_files: string[] } = {
	id: 'abc123_slug',
	tenant_id: 'acme',
	status: 'draft',
	title: 'Draft Post Title',
	content: 'This is the draft content body.',
	hashtags: [],
	media_type: 'image',
	media_path: null,
	platforms: ['instagram_feed'],
	workflow: null,
	scheduled_date: null,
	scheduled_time: null,
	published_at: null,
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z',
	filename: 'draft-post.md',
	media_files: []
}

const published: Post & { filename: string; media_files: string[] } = {
	...base,
	id: 'def456_slug',
	status: 'published',
	filename: 'published-post.md'
}

test('shows post title', async () => {
	const screen = await render(PostCard, {
		post: base,
		clientId: 'acme',
		onUpdateStatus: vi.fn(),
		onDelete: vi.fn(),
		onUpload: vi.fn()
	})
	await expect.element(screen.getByText('Draft Post Title')).toBeVisible()
})

test('draft post shows content preview', async () => {
	const screen = await render(PostCard, {
		post: base,
		clientId: 'acme',
		onUpdateStatus: vi.fn(),
		onDelete: vi.fn(),
		onUpload: vi.fn()
	})
	await expect.element(screen.getByText('This is the draft content body.')).toBeVisible()
})

test('published post does not show content preview', async () => {
	const screen = await render(PostCard, {
		post: published,
		clientId: 'acme',
		onUpdateStatus: vi.fn(),
		onDelete: vi.fn(),
		onUpload: vi.fn()
	})
	expect(screen.getByText('This is the draft content body.').elements()).toHaveLength(0)
})

test('draft post shows Approve button', async () => {
	const screen = await render(PostCard, {
		post: base,
		clientId: 'acme',
		onUpdateStatus: vi.fn(),
		onDelete: vi.fn(),
		onUpload: vi.fn()
	})
	await expect.element(screen.getByTitle('Approve Post')).toBeVisible()
})

test('published post shows Back to draft button', async () => {
	const screen = await render(PostCard, {
		post: published,
		clientId: 'acme',
		onUpdateStatus: vi.fn(),
		onDelete: vi.fn(),
		onUpload: vi.fn()
	})
	await expect.element(screen.getByText('Back to draft')).toBeVisible()
})

test('draft post does not show Back to draft', async () => {
	const screen = await render(PostCard, {
		post: base,
		clientId: 'acme',
		onUpdateStatus: vi.fn(),
		onDelete: vi.fn(),
		onUpload: vi.fn()
	})
	expect(screen.getByText('Back to draft').elements()).toHaveLength(0)
})

test('delete button is always visible', async () => {
	const screen = await render(PostCard, {
		post: published,
		clientId: 'acme',
		onUpdateStatus: vi.fn(),
		onDelete: vi.fn(),
		onUpload: vi.fn()
	})
	await expect.element(screen.getByTitle('Delete Post')).toBeVisible()
})

test('clicking delete calls onDelete with post id and filename', async () => {
	const onDelete = vi.fn()
	const screen = await render(PostCard, {
		post: base,
		clientId: 'acme',
		onUpdateStatus: vi.fn(),
		onDelete,
		onUpload: vi.fn()
	})
	await screen.getByTitle('Delete Post').click()
	expect(onDelete).toHaveBeenCalledWith('abc123_slug', 'draft-post.md')
})

test('clicking approve calls onUpdateStatus with approved', async () => {
	const onUpdateStatus = vi.fn()
	const screen = await render(PostCard, {
		post: base,
		clientId: 'acme',
		onUpdateStatus,
		onDelete: vi.fn(),
		onUpload: vi.fn()
	})
	await screen.getByTitle('Approve Post').click()
	expect(onUpdateStatus).toHaveBeenCalledWith('abc123_slug', 'draft-post.md', 'approved')
})
