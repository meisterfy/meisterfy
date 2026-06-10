import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTheme } from '@/store/theme'
import { ThemeToggle } from './theme-toggle'

// Minimal i18n setup for the component — import the configured instance
import '@/lib/i18n/index'

beforeEach(() => {
  // Reset store to a known state; avoid matchMedia calls in these render tests
  useTheme.setState({ theme: 'light' })
  document.documentElement.classList.remove('dark')
  // matchMedia stub (jsdom doesn't implement it)
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
})

describe('ThemeToggle', () => {
  it('renders three theme option buttons', () => {
    render(<ThemeToggle />)
    // Labels come from the en/settings.json translation
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('marks the active theme option as pressed', () => {
    useTheme.setState({ theme: 'dark' })
    render(<ThemeToggle />)
    const darkBtn = screen.getByTitle('Dark')
    const lightBtn = screen.getByTitle('Light')
    expect(darkBtn).toHaveAttribute('aria-pressed', 'true')
    expect(lightBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls setTheme when a theme option is clicked', async () => {
    const user = userEvent.setup()
    const setThemeSpy = vi.fn()
    useTheme.setState({ theme: 'light', setTheme: setThemeSpy })

    render(<ThemeToggle />)
    await user.click(screen.getByTitle('Dark'))

    expect(setThemeSpy).toHaveBeenCalledWith('dark')
  })

  it('calls setTheme with "system" when System is clicked', async () => {
    const user = userEvent.setup()
    const setThemeSpy = vi.fn()
    useTheme.setState({ theme: 'light', setTheme: setThemeSpy })

    render(<ThemeToggle />)
    await user.click(screen.getByTitle('System'))

    expect(setThemeSpy).toHaveBeenCalledWith('system')
  })
})
