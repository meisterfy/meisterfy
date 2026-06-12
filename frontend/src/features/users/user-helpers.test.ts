import { describe, it, expect } from 'vitest'
import { avatarColor, initials, localeName, roleName } from './user-helpers'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PALETTE = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
]

// Minimal fake translator: returns the key unchanged
const fakeT = (key: string, opts?: { defaultValue?: string }) =>
  opts?.defaultValue ?? key

// ---------------------------------------------------------------------------
// avatarColor
// ---------------------------------------------------------------------------

describe('avatarColor', () => {
  it('returns a color from the palette', () => {
    expect(PALETTE).toContain(avatarColor('user-123'))
  })

  it('is deterministic — same id always yields same color', () => {
    const id = 'some-user-id'
    expect(avatarColor(id)).toBe(avatarColor(id))
  })

  it('returns a palette color for the empty string (hash=0 → index 0)', () => {
    // hash for '' is 0; 0 % 6 === 0 → 'bg-indigo-500'
    expect(avatarColor('')).toBe('bg-indigo-500')
  })

  it('different ids can produce different colors', () => {
    // Not guaranteed but extremely likely for these two ids
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(avatarColor))
    expect(colors.size).toBeGreaterThan(1)
  })
})

// ---------------------------------------------------------------------------
// initials
// ---------------------------------------------------------------------------

describe('initials', () => {
  it("'John Doe' → 'JD'", () => {
    expect(initials('John Doe')).toBe('JD')
  })

  it("'madonna' (single word) → 'M'", () => {
    expect(initials('madonna')).toBe('M')
  })

  it("'a b c d' takes only first two words → 'AB'", () => {
    expect(initials('a b c d')).toBe('AB')
  })

  it('uppercases the result', () => {
    expect(initials('alice bob')).toBe('AB')
  })
})

// ---------------------------------------------------------------------------
// localeName
// ---------------------------------------------------------------------------

describe('localeName', () => {
  it("'pt-BR' calls t('lang_pt_br')", () => {
    expect(localeName('pt-BR', fakeT)).toBe('lang_pt_br')
  })

  it("'en-US' calls t('lang_en_us')", () => {
    expect(localeName('en-US', fakeT)).toBe('lang_en_us')
  })

  it('any other locale also falls through to lang_en_us', () => {
    expect(localeName('fr-FR', fakeT)).toBe('lang_en_us')
  })
})

// ---------------------------------------------------------------------------
// roleName
// ---------------------------------------------------------------------------

describe('roleName', () => {
  it('returns em-dash when role is undefined', () => {
    expect(roleName(undefined, fakeT)).toBe('—')
  })

  it('falls back to role.name when t has no translation (defaultValue path)', () => {
    // fakeT returns defaultValue when provided
    expect(roleName({ id: '1', name: 'admin' }, fakeT)).toBe('admin')
  })

  it('returns translated string when t resolves the key', () => {
    // a t that always returns a resolved value
    const resolvingT = (key: string, _opts?: { defaultValue?: string }) =>
      `translated:${key}`
    expect(roleName({ id: '1', name: 'admin' }, resolvingT)).toBe(
      'translated:roles_name_admin',
    )
  })
})
