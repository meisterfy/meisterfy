import { getPosts } from '$lib/api/posts'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = async ({ params, fetch }) => {
	const all = await getPosts(params.tenant, undefined, fetch).catch(() => [])
	const drafts = all
		.filter(p => p.status !== 'scheduled' && p.status !== 'published')
		.map(p => ({
			...p,
			client_id: p.tenant_id,
			filename: p.id + '.json',
			media_files: p.media_path ? [p.media_path] : [],
			platform: p.platforms?.[0] ?? null,
		}))
	return { tenant: params.tenant, drafts }
}
