import { describe, it, expect } from 'vitest'
import { getDiffs } from './diff'

describe('getDiffs', () => {
  it('returns empty array when objects are identical', () => {
    const result = getDiffs({ a: 1, b: 'hello' }, { a: 1, b: 'hello' })
    expect(result).toEqual([])
  })

  it('detects a flat changed value', () => {
    const result = getDiffs({ a: 1 }, { a: 2 })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ key: 'a', oldVal: 1, newVal: 2 })
  })

  it('recurses into nested objects and produces dotted key', () => {
    const before = { meta: { name: 'old', count: 5 } }
    const after = { meta: { name: 'new', count: 5 } }
    const result = getDiffs(before, after)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ key: 'meta.name', oldVal: 'old', newVal: 'new' })
  })

  it('handles added key (oldVal undefined)', () => {
    const result = getDiffs({}, { newKey: 'value' })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ key: 'newKey', oldVal: undefined, newVal: 'value' })
  })

  it('handles removed key (newVal undefined)', () => {
    const result = getDiffs({ oldKey: 42 }, {})
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ key: 'oldKey', oldVal: 42, newVal: undefined })
  })

  it('handles null before gracefully (treats as empty object)', () => {
    const result = getDiffs(null as unknown as Record<string, unknown>, { a: 1 })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ key: 'a', oldVal: undefined, newVal: 1 })
  })

  it('handles null after gracefully (treats as empty object)', () => {
    const result = getDiffs({ a: 1 }, null as unknown as Record<string, unknown>)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ key: 'a', oldVal: 1, newVal: undefined })
  })

  it('propagates prefix in recursive calls', () => {
    const before = { level1: { level2: { val: 'x' } } }
    const after = { level1: { level2: { val: 'y' } } }
    const result = getDiffs(before, after)
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe('level1.level2.val')
  })
})
