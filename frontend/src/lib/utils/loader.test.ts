import { describe, it, expect, beforeEach } from 'vitest'
import { withFallback } from './loader'
import { useAuth } from '../../store/auth'

beforeEach(() => useAuth.getState().clear())

describe('withFallback', () => {
  it('returns the resolved value on success', async () => {
    expect(await withFallback(Promise.resolve(42), 0)).toBe(42)
  })

  it('returns the fallback on a generic error', async () => {
    expect(await withFallback(Promise.reject(new Error('boom')), 'fb')).toBe('fb')
  })

  it('clears auth and returns fallback on a 401', async () => {
    useAuth.getState().setToken('T')
    const err = Object.assign(new Error('Unauthorized'), { status: 401 })
    const out = await withFallback(Promise.reject(err), [] as number[])
    expect(out).toEqual([])
    expect(useAuth.getState().isAuthenticated()).toBe(false)
  })
})
