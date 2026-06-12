import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch, clearToken } from './client'

beforeEach(() => clearToken())

describe('apiFetch', () => {
  it('refreshes on 401 then retries successfully', async () => {
    // fetchFn handles the original request (401) and the retry (ok). Refresh goes through global fetch.
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 })) // original -> 401
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 })) // retry -> ok
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'NEW' }), { status: 200 }))
    )
    const out = await apiFetch<{ ok: boolean }>('/x', {}, fetchFn)
    expect(out).toEqual({ ok: true })
    vi.unstubAllGlobals()
  })

  it('throws a 401 error when refresh fails', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 })))
    await expect(apiFetch('/x', {}, fetchFn)).rejects.toMatchObject({ status: 401 })
    vi.unstubAllGlobals()
  })

  it('returns undefined for 204 No Content responses', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
    const out = await apiFetch<undefined>('/x', {}, fetchFn)
    expect(out).toBeUndefined()
  })
})
