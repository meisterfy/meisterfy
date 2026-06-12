import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearToken } from './client'
import { listMcpKeys, createMcpKey } from './mcp-keys'
import { listPendingAdjustments } from './pending-adjustments'

beforeEach(() => clearToken())

describe('listMcpKeys', () => {
  it('requests the mcp-keys path and returns parsed data', async () => {
    const keys = [
      {
        id: 'k-1',
        name: 'My Key',
        role: 'readonly' as const,
        key_prefix: 'mcp_',
        created_at: '2024-01-01T00:00:00Z',
        last_used_at: null,
        expires_at: null
      }
    ]
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: keys }), { status: 200 }))

    const result = await listMcpKeys('tenant-1', fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/tenants/tenant-1/mcp-keys')
    expect(result).toEqual(keys)
  })
})

describe('createMcpKey', () => {
  it('posts to the mcp-keys path and returns created key with secret', async () => {
    const created = {
      id: 'k-2',
      name: 'New Key',
      role: 'editor' as const,
      key_prefix: 'mcp_',
      key: 'mcp_secret_value',
      created_at: '2024-01-02T00:00:00Z',
      last_used_at: null,
      expires_at: null
    }
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(created), { status: 200 }))

    const original = globalThis.fetch
    globalThis.fetch = fetchFn as typeof fetch
    try {
      const result = await createMcpKey('tenant-1', { name: 'New Key', role: 'editor' })
      const [url, opts] = fetchFn.mock.calls[0] as [string, RequestInit]
      expect(url).toMatch('/admin/tenants/tenant-1/mcp-keys')
      expect(opts.method).toBe('POST')
      expect(result).toEqual(created)
    } finally {
      globalThis.fetch = original
    }
  })
})

describe('listPendingAdjustments', () => {
  it('requests the pending-adjustments path and returns parsed data', async () => {
    const adjustments = [
      {
        id: 'adj-1',
        tenant_id: 'tenant-1',
        campaign_resource_id: 'cr-1',
        adjustment_type: 'bid_increase' as const,
        current_value: 1.5,
        proposed_value: 2.0,
        reason: 'Low CPA',
        status: 'pending' as const,
        created_at: '2024-01-01T00:00:00Z',
        expires_at: null,
        resolved_at: null,
        resolved_by: null
      }
    ]
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: adjustments }), { status: 200 }))

    const result = await listPendingAdjustments('tenant-1', undefined, fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/tenants/tenant-1/pending-adjustments')
    expect(result).toEqual(adjustments)
  })

  it('appends status query param when provided', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    await listPendingAdjustments('tenant-1', 'approved', fetchFn)

    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('status=approved')
  })
})
