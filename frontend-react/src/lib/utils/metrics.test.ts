import { describe, it, expect } from 'vitest'
import { wowDelta } from './metrics'
import { brl } from './format'

describe('wowDelta', () => {
  it('returns flat dash when prev is 0', () => {
    expect(wowDelta(10, 0)).toEqual({ pct: '—', dir: 'flat' })
  })

  it('treats sub-1% change as flat', () => {
    expect(wowDelta(100.5, 100)).toEqual({ pct: '~0%', dir: 'flat' })
  })

  it('reports an increase as up by default', () => {
    expect(wowDelta(120, 100)).toEqual({ pct: '+20%', dir: 'up' })
  })

  it('reports a decrease as down by default', () => {
    expect(wowDelta(80, 100)).toEqual({ pct: '-20%', dir: 'down' })
  })

  it('inverts direction when lowerIsBetter (e.g. CPA)', () => {
    expect(wowDelta(80, 100, true)).toEqual({ pct: '-20%', dir: 'up' })
    expect(wowDelta(120, 100, true)).toEqual({ pct: '+20%', dir: 'down' })
  })
})

describe('brl', () => {
  it('formats a number as R$ with two decimals', () => {
    expect(brl(12.5)).toBe('R$12.50')
    expect(brl(0)).toBe('R$0.00')
  })
})
