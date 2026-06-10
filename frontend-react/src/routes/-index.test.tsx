import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { HomeRoute } from './index'
import { isPlatformAdmin } from '../lib/utils/platform-access'
import { hasPermission } from '../lib/utils/permissions'

// ── API mock ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/api/tenants', () => ({
  getTenants: vi.fn(),
}))

// ── Router mock (Link → plain <a>) ───────────────────────────────────────────
// NOTE: vi.mock factories are hoisted before imports, so we cannot reference
// React or any imported value here. Instead we use a getter so the function
// body executes lazily (at render time), when React is already in scope.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    // Render Link as a plain anchor so tests don't need a full router.
    // The factory body is NOT hoisted — only the vi.mock call itself is.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: function MockLink({ to, params, children, className, title }: any) {
      const href: string = params
        ? Object.entries(params as Record<string, string>).reduce(
            (acc, [k, v]) => acc.replace(`$${k}`, v),
            to as string,
          )
        : (to as string)
      // Use a plain string tag so we don't need to import React
      return <a href={href} className={className} title={title}>{children}</a>
    },
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

import { getTenants } from '../lib/api/tenants'

const mockGetTenants = vi.mocked(getTenants)

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderHome(queryClient = makeQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <HomeRoute />
    </QueryClientProvider>,
  )
}

const TENANT_A = {
  id: 'acme',
  name: 'Acme Corp',
  language: 'en',
  niche: null,
  location: null,
  primary_persona: null,
  tone: null,
  instructions: null,
  hashtags: [],
  ads_monitoring: null,
  report_prompts: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  connectors: [{ id: 'fb', name: 'Facebook', logo_svg: '<svg/>', logo_png: '' }],
}

const TENANT_B = {
  id: 'globex',
  name: 'Globex',
  language: 'en',
  niche: null,
  location: null,
  primary_persona: null,
  tone: null,
  instructions: null,
  hashtags: [],
  ads_monitoring: null,
  report_prompts: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  connectors: [],
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function setUser(overrides: Partial<ReturnType<typeof useAuth.getState>['user']> = {}) {
  useAuth.setState({
    token: 'tok',
    user: {
      id: 'u1',
      name: 'Alice',
      email: 'a@b.c',
      tenant_id: '',
      permissions: [],
      locale: 'en',
      system_role: 'user',
      ...overrides,
    },
    pendingTerms: null,
  })
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  useAuth.getState().clear()
  sessionStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests — tenant listing ────────────────────────────────────────────────────

describe('HomeRoute — tenant listing', () => {
  it('renders both tenant names when 2 tenants are returned', async () => {
    setUser()
    mockGetTenants.mockResolvedValue([TENANT_A, TENANT_B])
    renderHome()

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      expect(screen.getByText('Globex')).toBeInTheDocument()
    })
  })

  it('tenant cards link to the tenant route', async () => {
    setUser()
    mockGetTenants.mockResolvedValue([TENANT_A])
    renderHome()

    await waitFor(() => {
      // The Link renders with href containing the tenant id
      const link = screen.getByRole('link', { name: /acme/i })
      expect(link).toHaveAttribute('href', expect.stringContaining('acme'))
    })
  })

  it('shows empty state when no tenants are returned', async () => {
    setUser()
    mockGetTenants.mockResolvedValue([])
    renderHome()

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
  })

  it('shows "No connectors" text for tenants with no connectors', async () => {
    setUser()
    mockGetTenants.mockResolvedValue([TENANT_B])
    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/no connectors/i)).toBeInTheDocument()
    })
  })
})

// ── Tests — permission-gated actions ─────────────────────────────────────────

describe('HomeRoute — Create Client button visibility', () => {
  it('shows Create Client button when user has create:tenant permission', async () => {
    setUser({ permissions: ['create:tenant'] })
    mockGetTenants.mockResolvedValue([])
    renderHome()

    await waitFor(() => {
      // At least one link/button with "new" in the href
      const links = screen.getAllByRole('link')
      const createLink = links.find((l) => l.getAttribute('href')?.includes('/tenants/new'))
      expect(createLink).toBeDefined()
    })
  })

  it('hides Create Client button when user lacks create:tenant permission', async () => {
    setUser({ permissions: [] })
    mockGetTenants.mockResolvedValue([])
    renderHome()

    await waitFor(() => {
      const links = screen.queryAllByRole('link')
      const createLink = links.find((l) => l.getAttribute('href')?.includes('/tenants/new'))
      expect(createLink).toBeUndefined()
    })
  })
})

describe('HomeRoute — Global Settings gear visibility', () => {
  it('shows Settings gear when user is platform_admin', async () => {
    setUser({ system_role: 'platform_admin' })
    mockGetTenants.mockResolvedValue([])
    renderHome()

    await waitFor(() => {
      expect(screen.getByTitle(/global settings/i)).toBeInTheDocument()
    })
  })

  it('hides Settings gear when user is not platform_admin', async () => {
    setUser({ system_role: 'user' })
    mockGetTenants.mockResolvedValue([])
    renderHome()

    await waitFor(() => {
      expect(screen.queryByTitle(/global settings/i)).toBeNull()
    })
  })
})

// ── Tests — welcome heading ───────────────────────────────────────────────────

describe('HomeRoute — welcome heading', () => {
  it('renders the user name in the welcome heading', async () => {
    setUser({ name: 'Bob' })
    mockGetTenants.mockResolvedValue([])
    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/bob/i)).toBeInTheDocument()
    })
  })
})

// ── Unit tests — hasPermission ────────────────────────────────────────────────

describe('hasPermission', () => {
  it('returns true when the permission is in the list', () => {
    expect(hasPermission(['create:tenant', 'read:tenant'], 'create:tenant')).toBe(true)
  })

  it('returns false when the permission is not in the list', () => {
    expect(hasPermission(['read:tenant'], 'create:tenant')).toBe(false)
  })

  it('returns false when permissions is undefined', () => {
    expect(hasPermission(undefined, 'create:tenant')).toBe(false)
  })

  it('returns false for an empty permissions array', () => {
    expect(hasPermission([], 'create:tenant')).toBe(false)
  })
})

// ── Unit tests — isPlatformAdmin ─────────────────────────────────────────────

describe('isPlatformAdmin', () => {
  it('returns true for system_role === platform_admin', () => {
    expect(
      isPlatformAdmin({ id: 'u1', name: 'Admin', email: 'a@b.c', tenant_id: '', permissions: [], locale: 'en', system_role: 'platform_admin' }),
    ).toBe(true)
  })

  it('returns false for system_role === user', () => {
    expect(
      isPlatformAdmin({ id: 'u1', name: 'U', email: 'a@b.c', tenant_id: '', permissions: [], locale: 'en', system_role: 'user' }),
    ).toBe(false)
  })

  it('returns false for null user', () => {
    expect(isPlatformAdmin(null)).toBe(false)
  })

  it('returns false for undefined user', () => {
    expect(isPlatformAdmin(undefined)).toBe(false)
  })
})
