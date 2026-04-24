import type { PostPlatform } from '$lib/server/db';

export const PLATFORM_CONFIG: Record<PostPlatform, { label: string; color: string }> = {
	instagram_feed:    { label: 'IG Feed',    color: 'bg-pink-500'   },
	instagram_stories: { label: 'IG Stories', color: 'bg-purple-500' },
	instagram_reels:   { label: 'IG Reels',   color: 'bg-rose-500'   },
	linkedin:          { label: 'LinkedIn',   color: 'bg-blue-600'   },
	facebook:          { label: 'Facebook',   color: 'bg-blue-500'   },
};

export const PLATFORM_OPTIONS: { value: PostPlatform; label: string }[] = Object.entries(PLATFORM_CONFIG).map(
	([value, { label }]) => ({ value: value as PostPlatform, label })
);

export function normPlatforms(raw: PostPlatform | PostPlatform[] | undefined): PostPlatform[] {
	if (!raw) return [];
	return Array.isArray(raw) ? raw : [raw];
}
