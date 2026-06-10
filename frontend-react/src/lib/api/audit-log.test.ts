import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearToken } from './client'
import { getAuditLog } from './audit-log'
import { getConnectorResources } from './connector-resources'

beforeEach(() => clearToken())

describe('getAuditLog', () => {
  it('requests the audit-log path without query string when no filter provided', async () => {
    const payload = { data: [], total: 0 }
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))

    const result = await getAuditLog('tenant-1', {}, fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/tenants/tenant-1/audit-log')
    expect(result).toEqual(payload)
  })

  it('appends filter params to the query string', async () => {
    const payload = { data: [], total: 0 }
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))

    await getAuditLog('tenant-1', { entity_type: 'campaign', limit: 20 }, fetchFn)

    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('entity_type=campaign')
    expect(url).toMatch('limit=20')
  })
})

describe('getConnectorResources', () => {
  it('requests the connectors path with provider and resource_type params', async () => {
    const resources = [
      {
        id: 'cr-1',
        tenant_id: 'tenant-1',
        integration_id: 'int-1',
        provider: 'google_ads',
        resource_type: 'campaign',
        resource_id: 'c-123',
        resource_name: 'My Campaign',
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: resources }), { status: 200 }))

    const result = await getConnectorResources('tenant-1', 'google_ads', 'campaign', fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/tenants/tenant-1/connectors')
    expect(url).toMatch('provider=google_ads')
    expect(url).toMatch('resource_type=campaign')
    expect(result).toEqual(resources)
  })
})
