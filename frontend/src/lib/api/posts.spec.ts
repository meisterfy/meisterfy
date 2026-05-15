import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPosts, getPost, createPost, updatePost, updatePostStatus, deletePost } from './posts'
import type { Post } from './posts'

const mockPost: Post = {
	id: 'p1',
	tenant_id: 't1',
	status: 'draft',
	title: 'Hello',
	content: 'World',
	hashtags: [],
	media_type: null,
	media_path: null,
	platforms: [],
	workflow: null,
	scheduled_date: null,
	scheduled_time: null,
	published_at: null,
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z'
}

function stubFetch(body: unknown, ok = true, status = 200) {
	const mock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
	vi.stubGlobal('fetch', mock)
	return mock
}

afterEach(() => vi.restoreAllMocks())

describe('getPosts', () => {
	it('calls correct endpoint without status filter', async () => {
		const mock = stubFetch({ data: [mockPost] })
		await getPosts('t1')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/posts')
		expect(url).not.toContain('status=')
	})

	it('appends status query param when provided', async () => {
		const mock = stubFetch({ data: [mockPost] })
		await getPosts('t1', 'draft')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('status=draft')
	})

	it('returns parsed post array', async () => {
		stubFetch({ data: [mockPost] })
		const result = await getPosts('t1')
		expect(result).toEqual([mockPost])
	})

	it('throws on non-ok response', async () => {
		stubFetch({ error: 'Forbidden' }, false, 403)
		await expect(getPosts('t1')).rejects.toThrow('Forbidden')
	})
})

describe('getPost', () => {
	it('calls correct endpoint', async () => {
		const mock = stubFetch({ data: mockPost })
		await getPost('t1', 'p1')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/posts/p1')
	})

	it('returns parsed post', async () => {
		stubFetch({ data: mockPost })
		const result = await getPost('t1', 'p1')
		expect(result.id).toBe('p1')
	})

	it('throws on not found', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getPost('t1', 'missing')).rejects.toThrow('Not found')
	})
})

describe('createPost', () => {
	it('sends POST to correct endpoint', async () => {
		const mock = stubFetch({ data: mockPost })
		await createPost('t1', { title: 'New', content: 'Body' })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/tenants/t1/posts')
		expect(init.method).toBe('POST')
	})

	it('sends the body as JSON', async () => {
		const mock = stubFetch({ data: mockPost })
		await createPost('t1', { title: 'New', content: 'Body' })
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.title).toBe('New')
	})

	it('returns the created post', async () => {
		stubFetch({ data: mockPost })
		const result = await createPost('t1', { title: 'New' })
		expect(result.id).toBe('p1')
	})

	it('throws on 422 validation error', async () => {
		stubFetch({ error: 'invalid payload' }, false, 422)
		await expect(createPost('t1', {})).rejects.toThrow('invalid payload')
	})
})

describe('updatePost', () => {
	it('sends PUT to correct endpoint', async () => {
		const mock = stubFetch({ data: mockPost })
		await updatePost('t1', 'p1', { title: 'Updated' })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/tenants/t1/posts/p1')
		expect(init.method).toBe('PUT')
	})

	it('sends updated fields in body', async () => {
		const mock = stubFetch({ data: mockPost })
		await updatePost('t1', 'p1', { title: 'Updated', content: 'New body' })
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.title).toBe('Updated')
		expect(body.content).toBe('New body')
	})

	it('throws on non-ok response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(updatePost('t1', 'missing', {})).rejects.toThrow('Not found')
	})
})

describe('updatePostStatus', () => {
	it('sends PATCH to status endpoint', async () => {
		const mock = stubFetch({ data: mockPost })
		await updatePostStatus('t1', 'p1', 'approved')
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/tenants/t1/posts/p1/status')
		expect(init.method).toBe('PATCH')
	})

	it('sends status in body', async () => {
		const mock = stubFetch({ data: mockPost })
		await updatePostStatus('t1', 'p1', 'scheduled')
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.status).toBe('scheduled')
	})

	it('includes scheduled_date and scheduled_time when provided', async () => {
		const mock = stubFetch({ data: mockPost })
		await updatePostStatus('t1', 'p1', 'scheduled', {
			scheduled_date: '2026-06-01',
			scheduled_time: '10:00'
		})
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.scheduled_date).toBe('2026-06-01')
		expect(body.scheduled_time).toBe('10:00')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'forbidden' }, false, 403)
		await expect(updatePostStatus('t1', 'p1', 'published')).rejects.toThrow('forbidden')
	})
})

describe('deletePost', () => {
	it('sends DELETE to correct endpoint', async () => {
		const mock = stubFetch({})
		await deletePost('t1', 'p1')
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/tenants/t1/posts/p1')
		expect(init.method).toBe('DELETE')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(deletePost('t1', 'missing')).rejects.toThrow('Not found')
	})
})
