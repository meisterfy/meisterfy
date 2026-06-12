import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Sun, Moon, Monitor } from 'lucide-react'

export type Theme = 'light' | 'dark' | 'system'

export const THEME_OPTIONS = [
  { value: 'light' as const, labelKey: 'settings:theme_light', icon: Sun },
  { value: 'dark' as const, labelKey: 'settings:theme_dark', icon: Moon },
  { value: 'system' as const, labelKey: 'settings:theme_system', icon: Monitor },
]

// Tracks the cleanup for the matchMedia listener while in system mode
let systemMediaCleanup: (() => void) | null = null

function applyThemeClass(theme: Theme): void {
  if (typeof document === 'undefined') return

  // Clean up any previous system-mode listener
  if (systemMediaCleanup) {
    systemMediaCleanup()
    systemMediaCleanup = null
  }

  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches)
    }
    mq.addEventListener('change', onSystemChange)
    systemMediaCleanup = () => mq.removeEventListener('change', onSystemChange)
    document.documentElement.classList.toggle('dark', mq.matches)
  } else {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
}

interface ThemeState {
  theme: Theme
  setTheme: (value: Theme) => void
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      // Default to 'dark' to match the <html class="dark"> shipped in index.html
      theme: 'dark' as Theme,
      setTheme: (value) => {
        applyThemeClass(value)
        set({ theme: value })
      },
    }),
    {
      name: 'meisterfy_theme',
      onRehydrateStorage: () => (state) => {
        // Apply the persisted theme as soon as the store hydrates
        if (state) applyThemeClass(state.theme)
      },
    },
  ),
)

// Apply on module load so the theme is set even before React mounts
applyThemeClass(useTheme.getState().theme)
