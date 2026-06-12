import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCampaignActions } from './use-campaign-actions'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/campaigns', () => ({
  syncHistory: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  getToken: vi.fn(() => 'tok'),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCampaignActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // ---- runSyncHistory — success -------------------------------------------

  it('runSyncHistory success: calls syncHistory, toasts success, syncing false after', async () => {
    const { syncHistory: mockSyncHistory } = await import('@/lib/api/campaigns')
    const { toast: mockToast } = await import('sonner')
    vi.mocked(mockSyncHistory).mockResolvedValueOnce({ from: '2024-01-01', to: '2024-01-31', rows: 42 })

    const { result } = renderHook(() => useCampaignActions())

    await act(async () => {
      await result.current.runSyncHistory('tenant-1')
    })

    expect(mockSyncHistory).toHaveBeenCalledWith('tenant-1')
    expect(mockToast.success).toHaveBeenCalledWith('Synced 42 rows', {
      description: '2024-01-01 → 2024-01-31',
    })
    expect(result.current.syncing).toBe(false)
  })

  // ---- runSyncHistory — failure -------------------------------------------

  it('runSyncHistory failure: toasts error with correct message', async () => {
    const { syncHistory: mockSyncHistory } = await import('@/lib/api/campaigns')
    const { toast: mockToast } = await import('sonner')
    vi.mocked(mockSyncHistory).mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useCampaignActions())

    await act(async () => {
      await result.current.runSyncHistory('tenant-1')
    })

    expect(mockToast.error).toHaveBeenCalledWith('Sync failed', {
      description: 'Check Google Ads integration',
    })
    expect(result.current.syncing).toBe(false)
  })

  // ---- runSyncHistory — re-entrancy guard ---------------------------------

  it('runSyncHistory re-entrancy: concurrent calls only invoke syncHistory once', async () => {
    const { syncHistory: mockSyncHistory } = await import('@/lib/api/campaigns')

    let resolveFirst!: () => void
    const firstPromise = new Promise<{ from: string; to: string; rows: number }>((resolve) => {
      resolveFirst = () => resolve({ from: '2024-01-01', to: '2024-01-31', rows: 5 })
    })
    vi.mocked(mockSyncHistory).mockReturnValueOnce(firstPromise)

    const { result } = renderHook(() => useCampaignActions())

    // Fire two calls without awaiting the first
    act(() => {
      result.current.runSyncHistory('tenant-1')
      result.current.runSyncHistory('tenant-1')
    })

    // Resolve the first call
    await act(async () => {
      resolveFirst()
    })

    expect(mockSyncHistory).toHaveBeenCalledTimes(1)
  })

  // ---- exportReport — success ---------------------------------------------

  it('exportReport success: fetches correct URL with Bearer header, triggers download', async () => {
    const { getToken: mockGetToken } = await import('@/lib/api/client')
    vi.mocked(mockGetToken).mockReturnValue('tok')

    const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    })
    vi.stubGlobal('fetch', mockFetch)

    const mockObjectURL = 'blob:http://localhost/fake-url'
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => mockObjectURL),
      revokeObjectURL: vi.fn(),
    })

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    // Track only anchor-element appends/removes
    const appendedAnchors: HTMLAnchorElement[] = []
    const removedAnchors: HTMLAnchorElement[] = []
    const origAppend = document.body.appendChild.bind(document.body)
    const origRemove = document.body.removeChild.bind(document.body)
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) appendedAnchors.push(node)
      return origAppend(node)
    })
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) removedAnchors.push(node as HTMLAnchorElement)
      return origRemove(node)
    })

    const { result } = renderHook(() => useCampaignActions())

    await act(async () => {
      await result.current.exportReport('camp-123', 'client-456')
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/reports/campaign/camp-123?client_id=client-456',
      { headers: { Authorization: 'Bearer tok' } },
    )
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(appendedAnchors).toHaveLength(1)
    expect(removedAnchors).toHaveLength(1)
    expect(result.current.exporting).toBe(false)
  })

  // ---- exportReport — non-ok response -------------------------------------

  it('exportReport non-ok response: toasts error', async () => {
    const { toast: mockToast } = await import('sonner')

    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useCampaignActions())

    await act(async () => {
      await result.current.exportReport('camp-123', 'client-456')
    })

    expect(mockToast.error).toHaveBeenCalledWith('Failed to generate report')
    expect(result.current.exporting).toBe(false)
  })

  // ---- exportReport — fetch throws ----------------------------------------

  it('exportReport fetch throws: toasts error', async () => {
    const { toast: mockToast } = await import('sonner')

    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useCampaignActions())

    await act(async () => {
      await result.current.exportReport('camp-123', 'client-456')
    })

    expect(mockToast.error).toHaveBeenCalledWith('Error exporting report')
    expect(result.current.exporting).toBe(false)
  })
})
