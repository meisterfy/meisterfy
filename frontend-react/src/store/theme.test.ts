import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useTheme } from './theme'

// jsdom does not implement matchMedia — provide a minimal stub
function stubMatchMedia(prefersDark: boolean) {
  const mq = {
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => mq))
  return mq
}

beforeEach(() => {
  // Reset document class and localStorage between tests
  document.documentElement.classList.remove('dark')
  localStorage.clear()
  // Reset store to the default 'dark' theme
  useTheme.setState({ theme: 'dark' })
  stubMatchMedia(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('theme store', () => {
  it('setTheme("light") removes the dark class', () => {
    document.documentElement.classList.add('dark')
    useTheme.getState().setTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(useTheme.getState().theme).toBe('light')
  })

  it('setTheme("dark") adds the dark class', () => {
    document.documentElement.classList.remove('dark')
    useTheme.getState().setTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(useTheme.getState().theme).toBe('dark')
  })

  it('setTheme("system") resolves via matchMedia (system prefers dark)', () => {
    stubMatchMedia(true)
    useTheme.getState().setTheme('system')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(useTheme.getState().theme).toBe('system')
  })

  it('setTheme("system") resolves via matchMedia (system prefers light)', () => {
    stubMatchMedia(false)
    useTheme.getState().setTheme('system')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(useTheme.getState().theme).toBe('system')
  })

  it('setTheme("system") registers a change listener on matchMedia', () => {
    const mq = stubMatchMedia(false)
    useTheme.getState().setTheme('system')
    expect(mq.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('persists theme to localStorage via zustand persist', () => {
    useTheme.getState().setTheme('light')
    // zustand/persist stores as JSON under the configured key
    const stored = localStorage.getItem('meisterfy_theme')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.theme).toBe('light')
  })

  it('THEME_OPTIONS exports 3 entries with correct labelKeys', async () => {
    const { THEME_OPTIONS } = await import('./theme')
    expect(THEME_OPTIONS).toHaveLength(3)
    expect(THEME_OPTIONS.map((o) => o.labelKey)).toEqual([
      'settings:theme_light',
      'settings:theme_dark',
      'settings:theme_system',
    ])
  })
})
