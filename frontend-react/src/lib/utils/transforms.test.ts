import { describe, it, expect } from 'vitest'
import { normalizePost, normalizeCampaign } from './transforms'
import type { Post } from '@/lib/api/posts'
import type { Campaign } from '@/lib/api/campaigns'

const basePost: Post = {
  id: 'p1',
  tenant_id: 't1',
  status: 'scheduled',
  title: 'Hello',
  content: 'Body',
  hashtags: ['a', 'b'],
  media_type: 'image',
  media_path: '/media/x.png',
  platforms: ['facebook', 'linkedin'],
  connector_resource_id: 'cr1',
  workflow: null,
  scheduled_date: '2026-06-10',
  scheduled_time: '09:00',
  published_at: null,
  created_at: '2026-06-01',
  updated_at: '2026-06-02',
}

describe('normalizePost', () => {
  it('maps API Post fields onto PostShape', () => {
    const shape = normalizePost(basePost)
    expect(shape).toMatchObject({
      id: 'p1',
      status: 'scheduled',
      title: 'Hello',
      content: 'Body',
      hashtags: ['a', 'b'],
      platform: ['facebook', 'linkedin'],
      client_id: 't1',
      media_files: ['/media/x.png'],
      connector_resource_id: 'cr1',
    })
  })

  it('defaults null title to empty string and missing media to []', () => {
    const shape = normalizePost({ ...basePost, title: null, media_path: null })
    expect(shape.title).toBe('')
    expect(shape.media_files).toEqual([])
  })
})

describe('normalizeCampaign', () => {
  it('spreads data.result and attaches client_id/slug/workflow', () => {
    const c: Campaign = {
      id: 'c1',
      tenant_id: 't1',
      slug: 'summer',
      data: { result: { name: 'Summer' }, workflow: { step: 'done' } },
    }
    const out = normalizeCampaign(c, 't1')
    expect(out).toEqual({ name: 'Summer', client_id: 't1', slug: 'summer', workflow: { step: 'done' } })
  })

  it('falls back to empty objects when data is missing', () => {
    const c = { id: 'c1', tenant_id: 't1', slug: 's', data: {} } as Campaign
    const out = normalizeCampaign(c, 't1')
    expect(out).toEqual({ client_id: 't1', slug: 's', workflow: {} })
  })
})
