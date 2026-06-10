import { describe, it, expect } from 'vitest'
import { parseHashtags } from './hashtags'

describe('parseHashtags', () => {
  it('strips leading # from tokens', () => {
    expect(parseHashtags('#a #b')).toEqual(['a', 'b'])
  })

  it('splits on whitespace and strips # prefix', () => {
    expect(parseHashtags('#a b  #c ')).toEqual(['a', 'b', 'c'])
  })

  it('handles tokens without # prefix', () => {
    expect(parseHashtags('foo bar')).toEqual(['foo', 'bar'])
  })

  it('returns empty array for empty string', () => {
    expect(parseHashtags('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(parseHashtags('   ')).toEqual([])
  })

  it('handles mixed # and non-# tokens', () => {
    expect(parseHashtags('#marketing brand #social')).toEqual(['marketing', 'brand', 'social'])
  })

  it('handles a single token with #', () => {
    expect(parseHashtags('#hello')).toEqual(['hello'])
  })
})
