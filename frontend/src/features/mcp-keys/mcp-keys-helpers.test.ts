import { describe, it, expect } from 'vitest'
import {
  roleBadgeClass,
  roleLabel,
  formatDate,
  relativeTime,
} from './mcp-keys-helpers'

// Minimal t stub — returns the key as-is for assertion
const t = (key: string) => key

// ---------------------------------------------------------------------------
// roleBadgeClass
// ---------------------------------------------------------------------------

describe('roleBadgeClass', () => {
  it('returns red classes for admin', () => {
    expect(roleBadgeClass('admin')).toBe(
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    )
  })

  it('returns blue classes for editor', () => {
    expect(roleBadgeClass('editor')).toBe(
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    )
  })

  it('returns slate classes for readonly (default)', () => {
    expect(roleBadgeClass('readonly')).toBe(
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    )
  })

  it('returns slate classes for any unknown role', () => {
    expect(roleBadgeClass('superuser')).toBe(
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    )
  })
})

// ---------------------------------------------------------------------------
// roleLabel
// ---------------------------------------------------------------------------

describe('roleLabel', () => {
  it('returns mcp_role_admin key for admin', () => {
    expect(roleLabel(t, 'admin')).toBe('mcp_role_admin')
  })

  it('returns mcp_role_editor key for editor', () => {
    expect(roleLabel(t, 'editor')).toBe('mcp_role_editor')
  })

  it('returns mcp_role_readonly key for readonly', () => {
    expect(roleLabel(t, 'readonly')).toBe('mcp_role_readonly')
  })

  it('returns mcp_role_readonly key for unknown role', () => {
    expect(roleLabel(t, 'guest')).toBe('mcp_role_readonly')
  })
})

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('returns mcp_never for null', () => {
    expect(formatDate(t, null)).toBe('mcp_never')
  })

  it('returns a locale date string for a valid ISO date', () => {
    const result = formatDate(t, '2024-06-15T12:00:00Z')
    // toLocaleDateString output varies by env — just verify it is not 'mcp_never'
    // and contains the year
    expect(result).not.toBe('mcp_never')
    expect(result).toContain('2024')
  })
})

// ---------------------------------------------------------------------------
// relativeTime
// ---------------------------------------------------------------------------

describe('relativeTime', () => {
  it('returns mcp_never for null', () => {
    expect(relativeTime(t, null)).toBe('mcp_never')
  })

  it('returns "Today" for a timestamp from today', () => {
    const now = new Date().toISOString()
    expect(relativeTime(t, now)).toBe('Today')
  })

  it('returns "1 day ago" for a timestamp from exactly 1 day ago', () => {
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString()
    expect(relativeTime(t, oneDayAgo)).toBe('1 day ago')
  })

  it('returns "N days ago" for a timestamp from N days ago', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString()
    expect(relativeTime(t, fiveDaysAgo)).toBe('5 days ago')
  })

  it('returns "2 days ago" for a boundary 2 days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString()
    expect(relativeTime(t, twoDaysAgo)).toBe('2 days ago')
  })
})
