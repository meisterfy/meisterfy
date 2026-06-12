import { describe, it, expect } from 'vitest'
import {
  interpolate,
  resolvePrompt,
  PROMPT_PARAMS,
  DEFAULT_PROMPTS,
} from './prompts'

describe('interpolate', () => {
  it('replaces all [brand_name] tokens', () => {
    const result = interpolate('Hello [brand_name], you are [brand_name]!', { name: 'Acme' })
    expect(result).toBe('Hello Acme, you are Acme!')
  })

  it('replaces [brand_niche] token', () => {
    const result = interpolate('Niche: [brand_niche]', { niche: 'Real estate' })
    expect(result).toBe('Niche: Real estate')
  })

  it('replaces [brand_location] token', () => {
    const result = interpolate('Location: [brand_location]', { location: 'São Paulo' })
    expect(result).toBe('Location: São Paulo')
  })

  it('replaces [brand_persona] token', () => {
    const result = interpolate('Persona: [brand_persona]', { primary_persona: 'Buyers aged 28-45' })
    expect(result).toBe('Persona: Buyers aged 28-45')
  })

  it('replaces [brand_tone] token', () => {
    const result = interpolate('Tone: [brand_tone]', { tone: 'Professional' })
    expect(result).toBe('Tone: Professional')
  })

  it('replaces [brand_instructions] token', () => {
    const result = interpolate('Instructions: [brand_instructions]', { instructions: 'No slang' })
    expect(result).toBe('Instructions: No slang')
  })

  it('empties missing tokens when brand fields are null/undefined', () => {
    const result = interpolate(
      '[brand_name] [brand_niche] [brand_location] [brand_persona] [brand_tone] [brand_instructions]',
      {},
    )
    expect(result).toBe('     ')
  })

  it('replaces every occurrence when template has multiple tokens', () => {
    const result = interpolate('[brand_name] is great. Contact [brand_name].', { name: 'Acme' })
    expect(result).toBe('Acme is great. Contact Acme.')
  })
})

describe('resolvePrompt', () => {
  const brand = { name: 'Acme', niche: 'SaaS' }

  it('uses DEFAULT_PROMPTS[type] when prompts is null', () => {
    const result = resolvePrompt('instant', null, brand)
    expect(result).toContain('Acme')
    expect(result).toContain('SaaS')
    // The template base should come from DEFAULT_PROMPTS.instant
    expect(result).toContain('Google Ads analyst for Acme')
  })

  it('uses DEFAULT_PROMPTS[type] when prompts is undefined', () => {
    const result = resolvePrompt('daily', undefined, brand)
    expect(result).toContain('Acme')
  })

  it('uses DEFAULT_PROMPTS[type] when prompts does not have the key', () => {
    const result = resolvePrompt('weekly', { instant: 'custom' }, brand)
    // No weekly override → falls back to DEFAULT_PROMPTS.weekly
    expect(result).toContain('weekly campaign performance')
  })

  it('uses the custom prompt when prompts has the key', () => {
    const result = resolvePrompt('instant', { instant: 'My custom prompt for [brand_name]' }, brand)
    expect(result).toBe('My custom prompt for Acme')
  })

  it('falls back for monthly type', () => {
    const result = resolvePrompt('monthly', null, { name: 'TestBrand' })
    expect(result).toContain('TestBrand')
    expect(result).toContain('monthly review')
  })
})

describe('PROMPT_PARAMS', () => {
  it('has exactly 6 entries', () => {
    expect(PROMPT_PARAMS).toHaveLength(6)
  })

  it('contains [brand_name] as the first entry', () => {
    expect(PROMPT_PARAMS[0].key).toBe('[brand_name]')
  })

  it('contains [brand_instructions] as the last entry', () => {
    expect(PROMPT_PARAMS[5].key).toBe('[brand_instructions]')
  })

  it('every entry has key, description, and example', () => {
    for (const param of PROMPT_PARAMS) {
      expect(param.key).toBeTruthy()
      expect(param.description).toBeTruthy()
      expect(param.example).toBeTruthy()
    }
  })
})

describe('DEFAULT_PROMPTS', () => {
  it('has all 4 prompt types', () => {
    expect(DEFAULT_PROMPTS.instant).toBeTruthy()
    expect(DEFAULT_PROMPTS.daily).toBeTruthy()
    expect(DEFAULT_PROMPTS.weekly).toBeTruthy()
    expect(DEFAULT_PROMPTS.monthly).toBeTruthy()
  })
})
