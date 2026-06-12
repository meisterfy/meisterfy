import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCampaignChat } from './use-campaign-chat'
import type { AIChunk } from '@/lib/api/ai'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/ai', () => ({
  streamGenerate: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT = 'tenant-1'
const CAMPAIGN = 'camp-1'
const KEY = `chat:${TENANT}:${CAMPAIGN}`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCampaignChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // ---- (1) loads persisted messages on init --------------------------------

  it('loads persisted messages from localStorage on init', () => {
    const stored = [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }]
    localStorage.setItem(KEY, JSON.stringify(stored))

    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))

    expect(result.current.messages).toEqual(stored)
  })

  it('starts with empty messages when nothing is persisted', () => {
    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))

    expect(result.current.messages).toEqual([])
  })

  // ---- (2) open / close / toggle flip isOpen --------------------------------

  it('open sets isOpen to true', () => {
    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))

    expect(result.current.isOpen).toBe(false)
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
  })

  it('close sets isOpen to false', () => {
    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))

    act(() => result.current.open())
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })

  it('toggle flips isOpen each call', () => {
    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))

    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(false)
  })

  // ---- (3) send — full happy path ------------------------------------------

  it('send pushes user + assistant placeholder, calls streamGenerate with task_type chat and history excluding placeholder, appends chunks, flips busy false, persists', async () => {
    const { streamGenerate } = await import('@/lib/api/ai')
    let capturedOnChunk: ((chunk: AIChunk) => void) | undefined
    let resolveStream!: () => void
    const streamPromise = new Promise<void>((res) => { resolveStream = res })

    vi.mocked(streamGenerate).mockImplementationOnce(async (_req, onChunk) => {
      capturedOnChunk = onChunk
      await streamPromise
    })

    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))
    const req = { tenant_id: TENANT, system: 'You are helpful.' }

    // Fire send — does not await yet (stream is pending)
    act(() => {
      result.current.send(req, 'What is the CPA?')
    })

    // After the synchronous part of send: busy true, messages has user + placeholder
    expect(result.current.busy).toBe(true)
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]).toEqual({ role: 'user', content: 'What is the CPA?' })
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant', content: '', streaming: true })

    // streamGenerate was called with task_type:'chat' and history = only the user message
    expect(streamGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: 'chat',
        messages: [{ role: 'user', content: 'What is the CPA?' }],
      }),
      expect.any(Function),
      expect.any(AbortSignal)
    )

    // Drive chunks
    await act(async () => {
      capturedOnChunk!({ content: 'The CPA ', done: false })
      capturedOnChunk!({ content: 'is $10.', done: false })
      capturedOnChunk!({ content: '', done: true })
    })

    // Chunk content accumulated
    expect(result.current.messages[1].content).toBe('The CPA is $10.')

    // Resolve stream (triggers finally)
    await act(async () => { resolveStream() })

    // After stream completes
    expect(result.current.busy).toBe(false)
    expect(result.current.messages[1].streaming).toBe(false)

    // Persisted to localStorage (busy is false now, effect fires)
    const saved = JSON.parse(localStorage.getItem(KEY)!)
    expect(saved).toHaveLength(2)
    expect(saved[0]).toEqual({ role: 'user', content: 'What is the CPA?' })
    expect(saved[1]).toEqual({ role: 'assistant', content: 'The CPA is $10.' })
    // No streaming flag in persisted copy
    expect(saved[1].streaming).toBeUndefined()
  })

  // ---- (4) send is no-op when busy or blank text ---------------------------

  it('send is a no-op when already busy', async () => {
    const { streamGenerate } = await import('@/lib/api/ai')
    let resolveFirst!: () => void
    vi.mocked(streamGenerate).mockReturnValueOnce(
      new Promise<void>((res) => { resolveFirst = res })
    )

    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))
    const req = { tenant_id: TENANT }

    // First send — makes it busy
    act(() => { result.current.send(req, 'First') })
    expect(result.current.busy).toBe(true)

    // Second send while busy — should be ignored
    await act(async () => { await result.current.send(req, 'Second') })

    expect(streamGenerate).toHaveBeenCalledTimes(1)

    await act(async () => { resolveFirst() })
  })

  it('send is a no-op when userText is blank', async () => {
    const { streamGenerate } = await import('@/lib/api/ai')

    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))

    await act(async () => {
      await result.current.send({ tenant_id: TENANT }, '   ')
    })

    expect(streamGenerate).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(0)
  })

  // ---- (5) error paths -------------------------------------------------------

  it('error path: streamGenerate rejects with non-AbortError → last message content starts with ⚠ Error:', async () => {
    const { streamGenerate } = await import('@/lib/api/ai')
    vi.mocked(streamGenerate).mockRejectedValueOnce(new Error('network timeout'))

    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))

    await act(async () => {
      await result.current.send({ tenant_id: TENANT }, 'Hello')
    })

    expect(result.current.busy).toBe(false)
    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.content).toMatch(/^⚠ Error:/)
    expect(last.content).toContain('network timeout')
  })

  it('error path: AbortError → last message content is NOT overwritten', async () => {
    const { streamGenerate } = await import('@/lib/api/ai')
    let capturedOnChunk: ((chunk: AIChunk) => void) | undefined
    let rejectStream!: (e: unknown) => void

    vi.mocked(streamGenerate).mockImplementationOnce(async (_req, onChunk) => {
      capturedOnChunk = onChunk
      return new Promise<void>((_res, rej) => { rejectStream = rej })
    })

    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))

    act(() => { result.current.send({ tenant_id: TENANT }, 'Hello') })

    // Deliver some content before aborting
    await act(async () => {
      capturedOnChunk!({ content: 'Partial answer', done: false })
    })

    const abortError = new DOMException('The user aborted a request.', 'AbortError')
    await act(async () => { rejectStream(abortError) })

    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.content).toBe('Partial answer')
    expect(last.content).not.toMatch(/^⚠ Error:/)
  })

  // ---- (6) abort clears streaming + busy -----------------------------------

  it('abort clears streaming flag and busy', async () => {
    const { streamGenerate } = await import('@/lib/api/ai')
    // Stream that never resolves (simulates in-progress)
    vi.mocked(streamGenerate).mockReturnValueOnce(new Promise<void>(() => {}))

    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))

    act(() => { result.current.send({ tenant_id: TENANT }, 'Hello') })
    expect(result.current.busy).toBe(true)
    expect(result.current.messages[1].streaming).toBe(true)

    act(() => { result.current.abort() })

    expect(result.current.busy).toBe(false)
    expect(result.current.messages[1].streaming).toBe(false)
  })

  // ---- (7) clear empties messages + persists empty -------------------------

  it('clear empties messages and persists empty array', () => {
    localStorage.setItem(KEY, JSON.stringify([{ role: 'user', content: 'old' }]))

    const { result } = renderHook(() => useCampaignChat(TENANT, CAMPAIGN))
    expect(result.current.messages).toHaveLength(1)

    act(() => { result.current.clear() })

    expect(result.current.messages).toHaveLength(0)

    // Effect fires (busy=false, messages=[]) → persists empty array
    const saved = JSON.parse(localStorage.getItem(KEY)!)
    expect(saved).toEqual([])
  })
})
