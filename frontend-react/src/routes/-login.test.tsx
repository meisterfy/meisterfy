import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAuth } from '../store/auth'
import { LoginRoute } from './login'

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

describe('LoginRoute', () => {
  it('renders email input, password input, and submit button', () => {
    render(<LoginRoute />)
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows the logo image', () => {
    render(<LoginRoute />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/logo.svg')
  })

  it('authenticates and sets the auth token on successful login', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'T',
          user: {
            id: 'u1',
            name: 'Alice',
            email: 'a@b.c',
            locale: 'en',
            system_role: 'user',
          },
          needs_tenant: false,
        }),
      }),
    )

    render(<LoginRoute />)
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.c')
    await user.type(screen.getByLabelText(/password/i), 'secret')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(useAuth.getState().isAuthenticated()).toBe(true)
    })
    expect(useAuth.getState().user?.email).toBe('a@b.c')

    vi.unstubAllGlobals()
  })

  it('shows an error message when login fails with a server error', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' }),
      }),
    )

    render(<LoginRoute />)
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'bad@b.c')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
    })

    vi.unstubAllGlobals()
  })

  it('shows a generic login_failed message when server error has no message', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    )

    render(<LoginRoute />)
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.c')
    await user.type(screen.getByLabelText(/password/i), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Login failed.')
    })

    vi.unstubAllGlobals()
  })

  it('shows a network error message when fetch throws', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')))

    render(<LoginRoute />)
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.c')
    await user.type(screen.getByLabelText(/password/i), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error.')
    })

    vi.unstubAllGlobals()
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
          json: async () => ({ access_token: 'T', user: { id: 'u1', name: 'A', email: 'a@b.c', locale: 'en', system_role: 'user' }, needs_tenant: false }),
        })),
      ),
    )

    render(<LoginRoute />)
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.c')
    await user.type(screen.getByLabelText(/password/i), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()

    resolveResponse!(undefined)
    await waitFor(() => {
      expect(useAuth.getState().isAuthenticated()).toBe(true)
    })

    vi.unstubAllGlobals()
  })

  it('navigates to / when needs_tenant is false', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'T',
          user: { id: 'u1', name: 'A', email: 'a@b.c', locale: 'en', system_role: 'user' },
          needs_tenant: false,
        }),
      }),
    )

    render(<LoginRoute />)
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.c')
    await user.type(screen.getByLabelText(/password/i), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
    })

    vi.unstubAllGlobals()
  })

  it('navigates to /tenants/new when needs_tenant is true', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'T',
          user: { id: 'u1', name: 'A', email: 'a@b.c', locale: 'en', system_role: 'user' },
          needs_tenant: true,
        }),
      }),
    )

    render(<LoginRoute />)
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.c')
    await user.type(screen.getByLabelText(/password/i), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/tenants/new' })
    })

    vi.unstubAllGlobals()
  })
})
