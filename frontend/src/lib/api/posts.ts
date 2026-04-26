import { apiFetch } from './client'

export type PostStatus = 'draft' | 'approved' | 'scheduled' | 'published'

export interface PostWorkflow {
	strategy?: { framework: string; reasoning: string }
	clarity?: { changes: string }
	impact?: { changes: string }
}

export interface Post {
	id: string
	tenant_id: string
	status: PostStatus
	title: string | null
	content: string
	hashtags: string[]
	media_type: string | null
	media_path: string | null
	platforms: string[]
	workflow: PostWorkflow | null
	scheduled_date: string | null
	scheduled_time: string | null
	published_at: string | null
	created_at: string
	updated_at: string
}

export const getPosts = (tenantId: string, status?: string) => {
	const qs = status ? `?status=${status}` : ''
	return apiFetch<{ data: Post[] }>(`/admin/tenants/${tenantId}/posts${qs}`).then(r => r.data)
}

export const getPost = (tenantId: string, id: string) =>
	apiFetch<{ data: Post }>(`/admin/tenants/${tenantId}/posts/${id}`).then(r => r.data)

export const createPost = (tenantId: string, body: Partial<Post>) =>
	apiFetch<{ data: Post }>(`/admin/tenants/${tenantId}/posts`, {
		method: 'POST',
		body: JSON.stringify(body),
	}).then(r => r.data)

export const updatePost = (tenantId: string, id: string, body: Partial<Post>) =>
	apiFetch<{ data: Post }>(`/admin/tenants/${tenantId}/posts/${id}`, {
		method: 'PUT',
		body: JSON.stringify(body),
	}).then(r => r.data)

export const updatePostStatus = (
	tenantId: string,
	id: string,
	status: PostStatus,
	opts?: { scheduled_date?: string; scheduled_time?: string }
) =>
	apiFetch<{ data: Post }>(`/admin/tenants/${tenantId}/posts/${id}/status`, {
		method: 'PATCH',
		body: JSON.stringify({ status, ...opts }),
	}).then(r => r.data)

export const deletePost = (tenantId: string, id: string) =>
	apiFetch<void>(`/admin/tenants/${tenantId}/posts/${id}`, { method: 'DELETE' })
