// @ts-nocheck
import { getPosts } from '$lib/api/posts'
import type { PageLoad } from './$types'

export const ssr = false

export const load = async ({ params }: Parameters<PageLoad>[0]) => {
	const scheduled = await getPosts(params.tenant, 'scheduled').catch(() => [])
	return {
		tenant: params.tenant,
		scheduled: scheduled.map(p => ({
			...p,
			client_id: p.tenant_id,
			filename: p.id + '.json',
			media_files: p.media_path ? [p.media_path] : [],
			scheduled_date: p.scheduled_date ?? p.id.slice(0, 10),
			platform: p.platforms?.[0] ?? null,
		})),
	}
}
