import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAuth } from '../../store/auth'
import { SettingsLayout } from './-route'

// ── Router mock ───────────────────────────────────────────────────────────────
const mockLocation = { pathname: '/settings/integrations' }

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    Outlet: () => <div data-testid='outlet' />,
    useLocation: () => mockLocation,
    // Render Link as plain anchor so tests don't need a full router
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: ({ to, children, className }: any) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  }
})

// ── i18n mock ─────────────────────────────────────────────────────────────────
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (ns?: string) => ({
      t: (key: string) => (ns ? `${ns}:${key}` : key),
    }),
  }
})

// ── Auth helpers ──────────────────────────────────────────────────────────────

type SystemRole = 'platform_admin' | 'user'

function setUser(systemRole: SystemRole = 'platform_admin') {
  useAuth.setState({
    token: 'tok',
    user: {
      id: 'u1',
      name: 'Admin',
      email: 'admin@test.com',
      tenant_id: '',
      permissions: [],
      locale: 'en',
      system_role: systemRole,
    },
    pendingTerms: null,
  })
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  useAuth.getState().clear()
  vi.clearAllMocks()
  mockLocation.pathname = '/settings/integrations'
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests — layout rendering ──────────────────────────────────────────────────

describe('SettingsLayout — rendering', () => {
  it('renders the settings title', () => {
    setUser()
    render(<SettingsLayout />)
    expect(screen.getByText('settings:title')).toBeInTheDocument()
  })

  it('renders the back button with correct aria-label', () => {
    setUser()
    render(<SettingsLayout />)
    const backBtn = screen.getByRole('button', { name: /settings:nav_back_aria/i })
    expect(backBtn).toBeInTheDocument()
  })

  it('renders the Integrations nav link with correct href', () => {
    setUser()
    render(<SettingsLayout />)
    const link = screen.getByRole('link', { name: /integrations:title/i })
    expect(link).toHaveAttribute('href', '/settings/integrations')
  })

  it('renders the Legal nav link pointing to /settings/legal', () => {
    setUser()
    render(<SettingsLayout />)
    const allLinks = screen.getAllByRole('link')
    const legalLink = allLinks.find((l) => l.getAttribute('href')?.includes('/settings/legal'))
    expect(legalLink).toBeDefined()
    expect(legalLink!).toHaveAttribute('href', '/settings/legal')
  })

  it('renders the outlet', () => {
    setUser()
    render(<SettingsLayout />)
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
  })
})

// ── Tests — active state ──────────────────────────────────────────────────────

describe('SettingsLayout — active state', () => {
  it('marks Integrations link as active when on /settings/integrations', () => {
    setUser()
    mockLocation.pathname = '/settings/integrations'
    render(<SettingsLayout />)
    const integLink = screen.getByRole('link', { name: /integrations:title/i })
    expect(integLink.className).toMatch(/bg-primary/)
  })

  it('does not mark Integrations link as active when on /settings/legal', () => {
    setUser()
    mockLocation.pathname = '/settings/legal'
    render(<SettingsLayout />)
    const integLink = screen.getByRole('link', { name: /integrations:title/i })
    expect(integLink.className).not.toMatch(/bg-primary/)
  })
})

// ── Tests — guard (beforeLoad) — unit-level ───────────────────────────────────
// These tests verify the guard logic inline (same way the existing routes do).
// We test the conditions directly since beforeLoad runs in the router context
// which isn't available in unit tests.

describe('SettingsLayout — beforeLoad guard logic', () => {
  it('isAuthenticated returns false when no token is set', () => {
    // store cleared in beforeEach
    expect(useAuth.getState().isAuthenticated()).toBe(false)
  })

  it('isAuthenticated returns true after setUser', () => {
    setUser()
    expect(useAuth.getState().isAuthenticated()).toBe(true)
  })

  it('isPlatformAdmin returns true for platform_admin user', async () => {
    setUser('platform_admin')
    const { isPlatformAdmin } = await import('../../lib/utils/platform-access')
    expect(isPlatformAdmin(useAuth.getState().user)).toBe(true)
  })

  it('isPlatformAdmin returns false for non-admin user', async () => {
    setUser('user')
    const { isPlatformAdmin } = await import('../../lib/utils/platform-access')
    expect(isPlatformAdmin(useAuth.getState().user)).toBe(false)
  })

  it('redirect throws a Response with status 307 when called', async () => {
    const { redirect } = await import('@tanstack/react-router')
    let thrown!: unknown
    try {
      throw redirect({ to: '/login' })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeTruthy()
    expect((thrown as Response).status).toBe(307)
  })
})
