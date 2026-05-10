import type { Post } from '$lib/api/posts'
import type { Campaign } from '$lib/api/campaigns'

type CampaignData = Record<string, string | number | boolean | null | object>

export function normalizePost(p: Post) {
  return {
    ...p,
    client_id: p.tenant_id,
    media_files: p.media_path ? [p.media_path] : [],
    platform: p.platforms?.[0] ?? null,
    scheduled_date: p.scheduled_date ?? p.id.slice(0, 10)
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
