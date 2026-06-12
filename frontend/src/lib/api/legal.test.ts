import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearToken } from './client'
import { getLegalVersions, getLegalVersion, createLegalVersion } from './legal'

beforeEach(() => clearToken())

describe('getLegalVersions', () => {
  it('requests /admin/legal/versions and returns the version array', async () => {
    const versions = [
      {
        id: 'v1',
        version: 1,
        fallback_locale: 'en',
        translations: {},
        effective_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z'
      }
    ]

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: versions }), { status: 200 }))

    const result = await getLegalVersions(fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/legal/versions')
    expect(result).toEqual(versions)
  })
})

describe('getLegalVersion', () => {
  it('requests the specific version by id', async () => {
    const version = {
      id: 'v2',
      version: 2,
      fallback_locale: 'pt',
      translations: { pt: [{ title: 'Termos', content: 'Conteúdo.' }] },
      effective_at: '2024-06-01T00:00:00Z',
      created_at: '2024-05-01T00:00:00Z'
    }

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: version }), { status: 200 }))

    const result = await getLegalVersion('v2', fetchFn)

    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/legal/versions/v2')
    expect(result).toEqual(version)
  })
})

describe('createLegalVersion', () => {
  it('issues a POST with the version body', async () => {
    const created = {
      id: 'v3',
      version: 3,
      fallback_locale: 'en',
      translations: { en: [{ title: 'Terms', content: 'Content.' }] },
      effective_at: '2025-01-01T00:00:00Z',
      created_at: '2024-12-01T00:00:00Z'
    }

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: created }), { status: 200 }))

    vi.stubGlobal('fetch', fetchFn)

    await createLegalVersion({
      fallback_locale: 'en',
      translations: { en: [{ title: 'Terms', content: 'Content.' }] },
      effective_at: '2025-01-01T00:00:00Z'
    })

    vi.unstubAllGlobals()

    const [url, options] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch('/admin/legal/versions')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body).toMatchObject({ fallback_locale: 'en', effective_at: '2025-01-01T00:00:00Z' })
  })
})
