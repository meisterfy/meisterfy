import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAuth } from '../../../store/auth'
import { TenantSettingsLayout } from './route'

// ── Router mock ───────────────────────────────────────────────────────────────
const mockLocation = { pathname: '/acme/settings/users' }
const mockParams = { tenant: 'acme' }

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    Outlet: () => <div data-testid='outlet'>child content</div>,
    useLocation: () => mockLocation,
    useParams: () => mockParams,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: ({ to, params, children, className }: any) => {
      const href = typeof to === 'string' ? to.replace('$tenant', params?.tenant ?? '') : to
      return (
        <a href={href} className={className} data-typed-link='true'>
          {children}
        </a>
      )
    },
  }
})

// ── i18n mock ─────────────────────────────────────────────────────────────────
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (_ns?: string) => ({
      t: (key: string) => key,
    }),
  }
})

// ── Auth helpers ──────────────────────────────────────────────────────────────

function setUser(permissions: string[] = ['view-any:user']) {
  useAuth.setState({
    token: 'tok',
    user: {
      id: 'u1',
      name: 'Alice',
      email: 'alice@test.com',
      tenant_id: 'acme',
      permissions,
      locale: 'en',
      system_role: 'user',
    },
    pendingTerms: null,
  })
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  useAuth.getState().clear()
  vi.clearAllMocks()
  mockLocation.pathname = '/acme/settings/users'
  mockParams.tenant = 'acme'
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests — nav labels ────────────────────────────────────────────────────────

describe('TenantSettingsLayout — nav labels', () => {
  it('renders all 7 nav section labels when user has view-any:user permission', () => {
    setUser(['view-any:user'])
    render(<TenantSettingsLayout />)

    // All 7 nav keys rendered (t returns the key as-is via mock)
    expect(screen.getByText('nav_general')).toBeInTheDocument()
    expect(screen.getByText('nav_google_ads')).toBeInTheDocument()
    expect(screen.getByText('nav_social')).toBeInTheDocument()
    expect(screen.getByText('nav_audit')).toBeInTheDocument()
    expect(screen.getByText('nav_users')).toBeInTheDocument()
    expect(screen.getByText('nav_roles')).toBeInTheDocument()
    expect(screen.getByText('nav_mcp')).toBeInTheDocument()
  })

  it('hides users/roles/mcp links when user lacks view-any:user permission', () => {
    setUser([]) // no permissions
    render(<TenantSettingsLayout />)

    expect(screen.getByText('nav_general')).toBeInTheDocument()
    expect(screen.getByText('nav_google_ads')).toBeInTheDocument()
    expect(screen.queryByText('nav_users')).not.toBeInTheDocument()
    expect(screen.queryByText('nav_roles')).not.toBeInTheDocument()
    expect(screen.queryByText('nav_mcp')).not.toBeInTheDocument()
  })
})

// ── Tests — users link is a typed Link ───────────────────────────────────────

describe('TenantSettingsLayout — users link', () => {
  it('renders the users nav item as a typed Link (data-typed-link)', () => {
    setUser(['view-any:user'])
    render(<TenantSettingsLayout />)

    const usersLink = screen.getByText('nav_users').closest('a')
    expect(usersLink).not.toBeNull()
    expect(usersLink!.getAttribute('data-typed-link')).toBe('true')
  })

  it('users Link resolves to the correct path for the tenant', () => {
    setUser(['view-any:user'])
    mockParams.tenant = 'acme'
    render(<TenantSettingsLayout />)

    const usersLink = screen.getByText('nav_users').closest('a')
    expect(usersLink!.getAttribute('href')).toBe('/acme/settings/users')
  })

  it('general Link is typed and resolves to the correct path for the tenant', () => {
    setUser(['view-any:user'])
    mockParams.tenant = 'acme'
    render(<TenantSettingsLayout />)

    const generalLink = screen.getByText('nav_general').closest('a')
    expect(generalLink!.getAttribute('data-typed-link')).toBe('true')
    expect(generalLink!.getAttribute('href')).toBe('/acme/settings/general')
  })

  it('social Link is typed and resolves to the correct path for the tenant', () => {
    setUser(['view-any:user'])
    mockParams.tenant = 'acme'
    render(<TenantSettingsLayout />)

    const socialLink = screen.getByText('nav_social').closest('a')
    expect(socialLink!.getAttribute('data-typed-link')).toBe('true')
    expect(socialLink!.getAttribute('href')).toBe('/acme/settings/social')
  })

  it('unimplemented section links are plain anchors (not data-typed-link)', () => {
    setUser(['view-any:user'])
    render(<TenantSettingsLayout />)

    // google-ads is the last section still pending its route (lands in B13)
    const googleAdsLink = screen.getByText('nav_google_ads').closest('a')
    expect(googleAdsLink!.getAttribute('data-typed-link')).toBeNull()
  })
})

// ── Tests — active state ──────────────────────────────────────────────────────

describe('TenantSettingsLayout — active state', () => {
  it('marks the users link as active when on /acme/settings/users', () => {
    setUser(['view-any:user'])
    mockLocation.pathname = '/acme/settings/users'
    render(<TenantSettingsLayout />)

    const usersLink = screen.getByText('nav_users').closest('a')
    expect(usersLink!.className).toMatch(/bg-primary/)
  })

  it('does not mark general link as active when on /acme/settings/users', () => {
    setUser(['view-any:user'])
    mockLocation.pathname = '/acme/settings/users'
    render(<TenantSettingsLayout />)

    const generalLink = screen.getByText('nav_general').closest('a')
    expect(generalLink!.className).not.toMatch(/bg-primary/)
  })

  it('marks the general link as active when on /acme/settings/general', () => {
    setUser([])
    mockLocation.pathname = '/acme/settings/general'
    render(<TenantSettingsLayout />)

    const generalLink = screen.getByText('nav_general').closest('a')
    expect(generalLink!.className).toMatch(/bg-primary/)
  })
})

// ── Tests — Outlet renders children ──────────────────────────────────────────

describe('TenantSettingsLayout — outlet', () => {
  it('renders the Outlet', () => {
    setUser()
    render(<TenantSettingsLayout />)
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
  })

  it('renders child content from the outlet', () => {
    setUser()
    render(<TenantSettingsLayout />)
    expect(screen.getByText('child content')).toBeInTheDocument()
  })
})

// ── Tests — beforeLoad guard logic ───────────────────────────────────────────

describe('TenantSettingsLayout — beforeLoad guard logic', () => {
  it('isAuthenticated returns false when no token set', () => {
    expect(useAuth.getState().isAuthenticated()).toBe(false)
  })

  it('isAuthenticated returns true after setUser', () => {
    setUser()
    expect(useAuth.getState().isAuthenticated()).toBe(true)
  })

  it('redirect throws a Response with status 307 when called', async () => {
    const { redirect } = await import('@tanstack/react-router')
    let thrown: unknown = null
    try {
      throw redirect({ to: '/login' })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeTruthy()
    expect((thrown as Response).status).toBe(307)
  })
})
