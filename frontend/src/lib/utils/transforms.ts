import type { Post } from '$lib/api/posts'
import type { Campaign } from '$lib/api/campaigns'
import type { PostShape, PostPlatform } from '$lib/social'

type CampaignData = Record<string, string | number | boolean | null | object>

export function normalizePost(p: Post): PostShape {
  return {
    id: p.id,
    status: p.status,
    title: p.title ?? '',
    content: p.content,
    hashtags: p.hashtags ?? [],
    media_type: p.media_type,
    scheduled_date: p.scheduled_date ?? null,
    scheduled_time: p.scheduled_time ?? null,
    platform: (p.platforms ?? []) as PostPlatform[],
    client_id: p.tenant_id,
    media_files: p.media_path ? [p.media_path] : [],
    workflow: p.workflow ?? null
  }
}

export function normalizeCampaign(c: Campaign, tenantId: string) {
  const data = (c.data ?? {}) as CampaignData
  const result = (data.result ?? {}) as CampaignData
  return {
    ...result,
    client_id: tenantId,
    slug: c.slug,
    workflow: (data.workflow ?? {}) as CampaignData
  }
}
