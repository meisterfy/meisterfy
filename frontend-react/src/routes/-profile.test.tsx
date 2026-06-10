import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAuth } from '../store/auth'
import { ProfileRoute } from './profile'

// ── API mock ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/api/users', () => ({
  updateMe: vi.fn(),
  changePassword: vi.fn(),
}))

// ── Router mock (Link → plain <a>) ────────────────────────────────────────────
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: function MockLink({ to, children, className, 'aria-label': ariaLabel }: any) {
      return (
        <a href={to as string} className={className} aria-label={ariaLabel}>
          {children}
        </a>
      )
    },
  }
})

// ── Imports after mocks ───────────────────────────────────────────────────────
import { updateMe, changePassword } from '../lib/api/users'

const mockUpdateMe = vi.mocked(updateMe)
const mockChangePassword = vi.mocked(changePassword)

// ── Auth helpers ───────────────────────────────────────────────────────────────

function setUser() {
  useAuth.setState({
    token: 'tok',
    user: {
      id: 'u1',
      name: 'Alice Smith',
      email: 'alice@example.com',
      tenant_id: 't1',
      permissions: [],
      locale: 'en_US',
      timezone: 'America/Sao_Paulo',
      system_role: 'user',
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

// ── Tests — rendering ─────────────────────────────────────────────────────────

describe('ProfileRoute — rendering', () => {
  it('renders profile title and subtitle', () => {
    setUser()
    render(<ProfileRoute />)
    expect(screen.getByText('Your Profile')).toBeInTheDocument()
    expect(screen.getByText('Manage your personal preferences')).toBeInTheDocument()
  })

  it('renders the back link to /', () => {
    setUser()
    render(<ProfileRoute />)
    const backLink = screen.getByRole('link', { name: /back to dashboard/i })
    expect(backLink).toHaveAttribute('href', '/')
  })

  it('pre-fills name and email from auth user', () => {
    setUser()
    render(<ProfileRoute />)
    expect(screen.getByDisplayValue('Alice Smith')).toBeInTheDocument()
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument()
  })

  it('renders the Personal Information section heading', () => {
    setUser()
    render(<ProfileRoute />)
    expect(screen.getByText('Personal Information')).toBeInTheDocument()
  })

  it('renders the Change Password section heading', () => {
    setUser()
    render(<ProfileRoute />)
    // The heading is an h2; the button also says "Change Password" so query by role
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument()
  })
})

// ── Tests — profile form ──────────────────────────────────────────────────────

describe('ProfileRoute — save profile', () => {
  it('calls updateMe with the updated body on submit', async () => {
    const user = userEvent.setup()
    setUser()

    const updatedUser = {
      id: 'u1',
      name: 'Alice Updated',
      email: 'alice@example.com',
      tenant_id: 't1',
      permissions: [],
      locale: 'en_US',
      timezone: 'America/Sao_Paulo',
      system_role: 'user' as const,
    }
    mockUpdateMe.mockResolvedValue(updatedUser)

    render(<ProfileRoute />)

    const nameInput = screen.getByDisplayValue('Alice Smith')
    await user.clear(nameInput)
    await user.type(nameInput, 'Alice Updated')

    const submitBtn = screen.getByRole('button', { name: /save changes/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(mockUpdateMe).toHaveBeenCalledWith({
        name: 'Alice Updated',
        email: 'alice@example.com',
        locale: 'en_US',
        timezone: 'America/Sao_Paulo',
      })
    })
  })

  it('calls setUser with the updated user after a successful save', async () => {
    const user = userEvent.setup()
    setUser()

    const updatedUser = {
      id: 'u1',
      name: 'Alice Updated',
      email: 'alice@example.com',
      tenant_id: 't1',
      permissions: [],
      locale: 'en_US',
      timezone: 'America/Sao_Paulo',
      system_role: 'user' as const,
    }
    mockUpdateMe.mockResolvedValue(updatedUser)

    render(<ProfileRoute />)

    const nameInput = screen.getByDisplayValue('Alice Smith')
    await user.clear(nameInput)
    await user.type(nameInput, 'Alice Updated')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(useAuth.getState().user?.name).toBe('Alice Updated')
    })
  })

  it('shows the Saved indicator after a successful save', async () => {
    const user = userEvent.setup()
    setUser()
    mockUpdateMe.mockResolvedValue({
      id: 'u1',
      name: 'Alice Smith',
      email: 'alice@example.com',
      tenant_id: 't1',
      permissions: [],
      locale: 'en_US',
      timezone: 'America/Sao_Paulo',
      system_role: 'user' as const,
    })

    render(<ProfileRoute />)
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByTestId('profile-saved')).toBeInTheDocument()
    })
  })

  it('shows an error when updateMe rejects', async () => {
    const user = userEvent.setup()
    setUser()
    mockUpdateMe.mockRejectedValue(new Error('Server error'))

    render(<ProfileRoute />)
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error')
    })
  })

  it('falls back to "Save failed" when error has no message', async () => {
    const user = userEvent.setup()
    setUser()
    mockUpdateMe.mockRejectedValue({})

    render(<ProfileRoute />)
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Save failed')
    })
  })
})

// ── Tests — password form ─────────────────────────────────────────────────────

describe('ProfileRoute — change password', () => {
  it('shows "New passwords do not match" error when passwords differ', async () => {
    const user = userEvent.setup()
    setUser()

    render(<ProfileRoute />)

    await user.type(screen.getByLabelText(/current password/i), 'OldPass1')
    await user.type(screen.getByLabelText(/^new password/i), 'NewPass1')
    await user.type(screen.getByLabelText(/confirm new password/i), 'DifferentPass')

    // There are two submit buttons; the second one is for password
    const submitBtns = screen.getAllByRole('button', { name: /change password/i })
    await user.click(submitBtns[0])

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('New passwords do not match')
    })

    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('calls changePassword with correct body when passwords match', async () => {
    const user = userEvent.setup()
    setUser()
    mockChangePassword.mockResolvedValue({
      access_token: 'new-token',
      expires_at: '2099-01-01T00:00:00Z',
    })

    render(<ProfileRoute />)

    await user.type(screen.getByLabelText(/current password/i), 'OldPass1')
    await user.type(screen.getByLabelText(/^new password/i), 'NewPass1')
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPass1')

    const submitBtns = screen.getAllByRole('button', { name: /change password/i })
    await user.click(submitBtns[0])

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        current_password: 'OldPass1',
        new_password: 'NewPass1',
      })
    })
  })

  it('adopts the new token returned by changePassword', async () => {
    const user = userEvent.setup()
    setUser()
    mockChangePassword.mockResolvedValue({
      access_token: 'brand-new-token',
      expires_at: '2099-01-01T00:00:00Z',
    })

    render(<ProfileRoute />)

    await user.type(screen.getByLabelText(/current password/i), 'OldPass1')
    await user.type(screen.getByLabelText(/^new password/i), 'NewPass1')
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPass1')

    const submitBtns = screen.getAllByRole('button', { name: /change password/i })
    await user.click(submitBtns[0])

    await waitFor(() => {
      expect(useAuth.getState().token).toBe('brand-new-token')
    })
  })

  it('shows the "Password updated" saved indicator after a successful change', async () => {
    const user = userEvent.setup()
    setUser()
    mockChangePassword.mockResolvedValue({
      access_token: 'new-token',
      expires_at: '2099-01-01T00:00:00Z',
    })

    render(<ProfileRoute />)

    await user.type(screen.getByLabelText(/current password/i), 'OldPass1')
    await user.type(screen.getByLabelText(/^new password/i), 'NewPass1')
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPass1')

    const submitBtns = screen.getAllByRole('button', { name: /change password/i })
    await user.click(submitBtns[0])

    await waitFor(() => {
      expect(screen.getByTestId('pw-saved')).toBeInTheDocument()
      expect(screen.getByText(/password updated/i)).toBeInTheDocument()
    })
  })

  it('shows an error when changePassword rejects', async () => {
    const user = userEvent.setup()
    setUser()
    mockChangePassword.mockRejectedValue(new Error('Wrong current password'))

    render(<ProfileRoute />)

    await user.type(screen.getByLabelText(/current password/i), 'WrongPass')
    await user.type(screen.getByLabelText(/^new password/i), 'NewPass1')
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPass1')

    const submitBtns = screen.getAllByRole('button', { name: /change password/i })
    await user.click(submitBtns[0])

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Wrong current password')
    })
  })
})
