import type { PostStatus, PostWorkflow } from '$lib/api/posts'

export type PostPlatform =
	| 'instagram_feed'
	| 'instagram_stories'
	| 'instagram_reels'
	| 'linkedin'
	| 'facebook'

export const PLATFORM_CONFIG: Record<PostPlatform, { label: string; color: string }> = {
	instagram_feed: { label: 'IG Feed', color: 'bg-pink-500' },
	instagram_stories: { label: 'IG Stories', color: 'bg-purple-500' },
	instagram_reels: { label: 'IG Reels', color: 'bg-rose-500' },
	linkedin: { label: 'LinkedIn', color: 'bg-blue-600' },
	facebook: { label: 'Facebook', color: 'bg-blue-500' }
}

export const BRAND_COLOR: Record<PostPlatform, string> = {
	instagram_feed: '#E1306C',
	instagram_stories: '#C13584',
	instagram_reels: '#FF0000',
	linkedin: '#0A66C2',
	facebook: '#1877F2'
}

export const PLATFORM_OPTIONS: { value: PostPlatform; label: string }[] = Object.entries(
	PLATFORM_CONFIG
).map(([value, { label }]) => ({ value: value as PostPlatform, label }))

export function normPlatforms(raw: PostPlatform | PostPlatform[] | undefined): PostPlatform[] {
	if (!raw) return []
	return Array.isArray(raw) ? raw : [raw]
}

export type PostShape = {
	id: string
	status: PostStatus
	title: string
	content: string
	hashtags: string[]
	media_type?: string | null
	scheduled_date?: string | null
	scheduled_time?: string | null
	platform: PostPlatform | PostPlatform[] | undefined
	client_id: string
	media_files: string[]
	workflow: PostWorkflow | null
	filename?: string
}
