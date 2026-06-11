import { describe, it, expect } from 'vitest'
import { PLATFORM_CONFIG, BRAND_COLOR, PLATFORM_OPTIONS, normPlatforms } from './social'

describe('social', () => {
  it('PLATFORM_CONFIG covers all five platforms with label + color', () => {
    const keys = Object.keys(PLATFORM_CONFIG)
    expect(keys).toEqual([
      'instagram_feed',
      'instagram_stories',
      'instagram_reels',
      'linkedin',
      'facebook',
    ])
    expect(PLATFORM_CONFIG.linkedin).toEqual({ label: 'LinkedIn', color: 'bg-blue-600' })
  })

  it('BRAND_COLOR has a hex for every platform', () => {
    expect(BRAND_COLOR.instagram_feed).toBe('#E1306C')
    expect(Object.keys(BRAND_COLOR)).toHaveLength(5)
  })

  it('PLATFORM_OPTIONS derives {value,label} pairs from PLATFORM_CONFIG order', () => {
    expect(PLATFORM_OPTIONS).toHaveLength(5)
    expect(PLATFORM_OPTIONS[0]).toEqual({ value: 'instagram_feed', label: 'IG Feed' })
    expect(PLATFORM_OPTIONS[3]).toEqual({ value: 'linkedin', label: 'LinkedIn' })
  })

  it('normPlatforms returns the array or [] for undefined', () => {
    expect(normPlatforms(undefined)).toEqual([])
    expect(normPlatforms(['facebook'])).toEqual(['facebook'])
  })
})
