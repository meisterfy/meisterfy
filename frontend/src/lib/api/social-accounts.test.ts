import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearToken } from './client'
import { getAvailableMetaPages, getConnectedMetaPages } from './social-accounts'

beforeEach(() => clearToken())

describe('getAvailableMetaPages', () => {
  it('requests the available-pages path and returns parsed data', async () => {
    const pages = [
      {
        page_id: 'p-1',
        page_name: 'My Page',
        ig_user_id: 'ig-1',
        ig_username: 'mypage',
        already_connected: false
      }
    ]
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: pages }), { status: 200 }))

    const result = await getAvailableMetaPages('tenant-1', fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/tenants/tenant-1/meta/available-pages')
    expect(result).toEqual(pages)
  })
})

describe('getConnectedMetaPages', () => {
  it('requests the meta/accounts path and returns parsed data', async () => {
    const connected = [
      {
        id: 'cr-1',
        resource_name: 'My Page',
        metadata: { ig_user_id: 'ig-1', ig_username: 'mypage' }
      }
    ]
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: connected }), { status: 200 }))

    const result = await getConnectedMetaPages('tenant-1', fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/tenants/tenant-1/meta/accounts')
    expect(result).toEqual(connected)
  })
})
