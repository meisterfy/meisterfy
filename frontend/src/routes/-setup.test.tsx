import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAuth } from '../store/auth'
import { SetupRoute } from './-setup'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    useNavigate: () => mockNavigate,
  }
})

beforeEach(() => {
  useAuth.getState().clear()
  sessionStorage.clear()
  mockNavigate.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'u1',
  name: 'Admin',
  email: 'admin@example.com',
  locale: 'en',
  system_role: 'platform_admin' as const,
}

function mockSetupSuccess(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'tok-abc',
        user: MOCK_USER,
        needs_tenant: false,
        ...overrides,
      }),
    }),
  )
}

function mockSetupError(errorMsg = 'Setup failed') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: errorMsg }),
    }),
  )
}

async function fillAndSubmitStep1(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^name$/i), 'Admin')
  await user.type(screen.getByLabelText(/^email$/i), 'admin@example.com')
  await user.type(screen.getByLabelText(/^password$/i), 'securepass')
  await user.click(screen.getByRole('button', { name: /create account/i }))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SetupRoute — step 1', () => {
  it('renders the name, email, password fields and create account button', () => {
    render(<SetupRoute />)
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('renders the setup title and subtitle', () => {
    render(<SetupRoute />)
    expect(screen.getByText('Welcome to Meisterfy')).toBeInTheDocument()
    expect(
      screen.getByText('Create the first admin account to get started.'),
    ).toBeInTheDocument()
  })

  it('disables the submit button while loading', async () => {
    const user = userEvent.setup()
    let resolveResponse: (value: unknown) => void
    const pending = new Promise((res) => {
      resolveResponse = res
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        pending.then(() => ({
          ok: true,
          json: async () => ({
            access_token: 'tok',
            user: MOCK_USER,
            needs_tenant: false,
          }),
        })),
      ),
    )

    render(<SetupRoute />)
    await user.type(screen.getByLabelText(/^name$/i), 'Admin')
    await user.type(screen.getByLabelText(/^email$/i), 'admin@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'securepass')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled()

    resolveResponse!(undefined)
    await waitFor(() => {
      expect(screen.getByText(/configure your tools/i)).toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })

  it('shows error alert when POST /setup returns !ok', async () => {
    const user = userEvent.setup()
    mockSetupError('Email already taken')

    render(<SetupRoute />)
    await fillAndSubmitStep1(user)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email already taken')
    })

    vi.unstubAllGlobals()
  })

  it('shows "Setup failed" fallback error when server returns no error message', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    )

    render(<SetupRoute />)
    await fillAndSubmitStep1(user)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Setup failed')
    })

    vi.unstubAllGlobals()
  })

  it('shows "Network error" when fetch throws', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')))

    render(<SetupRoute />)
    await fillAndSubmitStep1(user)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error')
    })

    vi.unstubAllGlobals()
  })

  it('advances to step 2 and sets auth token on successful submit', async () => {
    const user = userEvent.setup()
    mockSetupSuccess()

    render(<SetupRoute />)
    await fillAndSubmitStep1(user)

    await waitFor(() => {
      expect(screen.getByText(/configure your tools/i)).toBeInTheDocument()
    })

    expect(useAuth.getState().isAuthenticated()).toBe(true)
    expect(useAuth.getState().user?.email).toBe('admin@example.com')

    vi.unstubAllGlobals()
  })
})

describe('SetupRoute — step 2 (tools)', () => {
  async function renderStep2(overrides: Record<string, unknown> = {}) {
    const user = userEvent.setup()
    mockSetupSuccess(overrides)
    render(<SetupRoute />)
    await fillAndSubmitStep1(user)
    await waitFor(() => {
      expect(screen.getByText(/configure your tools/i)).toBeInTheDocument()
    })
    vi.unstubAllGlobals()
    return user
  }

  it('shows the tools title and subtitle', async () => {
    await renderStep2()
    expect(screen.getByText(/configure your tools/i)).toBeInTheDocument()
    expect(
      screen.getByText(/connect your integrations now or later/i),
    ).toBeInTheDocument()
  })

  it('shows the Google Ads card with a Connect link to /auth/google-ads/start', async () => {
    await renderStep2()
    const connectLink = screen.getByRole('link', { name: /connect/i })
    expect(connectLink).toHaveAttribute('href', '/auth/google-ads/start')
  })

  it('shows the AI Provider card with a Configure link to /settings/integrations', async () => {
    await renderStep2()
    const configureLink = screen.getByRole('link', { name: /configure/i })
    expect(configureLink).toHaveAttribute('href', '/settings/integrations')
  })

  it('skip navigates to / when needs_tenant is false', async () => {
    const user = await renderStep2({ needs_tenant: false })
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
  })

  it('skip navigates to /tenants/new when needs_tenant is true', async () => {
    const user = await renderStep2({ needs_tenant: true })
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/tenants/new' })
  })
})
