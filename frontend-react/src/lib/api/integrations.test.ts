import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearToken } from './client'
import { getIntegrations } from './integrations'

beforeEach(() => clearToken())

describe('getIntegrations', () => {
  it('requests /admin/integrations and returns the full response', async () => {
    const payload = {
      integrations: [
        {
          id: 'int-1',
          name: 'My Integration',
          provider: 'google_ads',
          group: 'ads',
          status: 'connected',
          error_message: null,
          tenant_ids: ['t-1'],
          config: {},
          has_credentials: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      providers: []
    }

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))

    const result = await getIntegrations(fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/integrations')
    expect(result).toEqual(payload)
  })
})
