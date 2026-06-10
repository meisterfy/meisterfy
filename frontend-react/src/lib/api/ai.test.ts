import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearToken } from './client'
import { getAIProviders } from './ai'
import { listAIReports, saveAIReport } from './ai-reports'

beforeEach(() => clearToken())

describe('getAIProviders', () => {
  it('requests the correct providers path and returns parsed data', async () => {
    const providers = [{ name: 'openai' }, { name: 'anthropic' }]
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: providers }), { status: 200 }))

    const result = await getAIProviders('tenant-1', fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/tenants/tenant-1/ai/providers')
    expect(result).toEqual(providers)
  })
})

describe('listAIReports', () => {
  it('requests the correct ai-reports path with query params and returns parsed data', async () => {
    const reports = [
      {
        id: 'r-1',
        tenant_id: 'tenant-1',
        campaign_id: 'camp-1',
        report_type: 'instant',
        content: 'report content',
        period_start: null,
        period_end: null,
        generated_at: '2024-01-01T00:00:00Z',
        generated_by_name: null,
        model: null
      }
    ]
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: reports }), { status: 200 }))

    const result = await listAIReports('tenant-1', 'camp-1', 'instant', 5, fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/tenants/tenant-1/campaigns/camp-1/ai-reports')
    expect(url).toMatch('type=instant')
    expect(url).toMatch('limit=5')
    expect(result).toEqual(reports)
  })
})

describe('saveAIReport', () => {
  it('posts to the correct path and returns parsed data', async () => {
    const report = {
      id: 'r-2',
      tenant_id: 'tenant-1',
      campaign_id: 'camp-1',
      report_type: 'instant',
      content: 'new content',
      period_start: null,
      period_end: null,
      generated_at: '2024-01-02T00:00:00Z',
      generated_by_name: null,
      model: 'gpt-4'
    }
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: report }), { status: 200 }))

    // saveAIReport does not accept a fetchFn, so we stub globalThis.fetch
    const original = globalThis.fetch
    globalThis.fetch = fetchFn as typeof fetch
    try {
      const result = await saveAIReport('tenant-1', 'camp-1', { content: 'new content', model: 'gpt-4' })
      const [url, opts] = fetchFn.mock.calls[0] as [string, RequestInit]
      expect(url).toMatch('/admin/tenants/tenant-1/campaigns/camp-1/ai-reports')
      expect(opts.method).toBe('POST')
      expect(result).toEqual(report)
    } finally {
      globalThis.fetch = original
    }
  })
})
