import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@/lib/i18n/index'

import { InviteDrawer } from './invite-drawer'
import { EditDrawer } from './edit-drawer'
import { ReactivateDrawer } from './reactivate-drawer'
import type { AdminUser, AdminRole } from '@/lib/api/admin-users'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/admin-users', () => ({
  createTenantUser: vi.fn(),
  updateTenantUser: vi.fn(),
  assignUserRole: vi.fn(),
  reactivateTenantUser: vi.fn(),
}))

import {
  createTenantUser,
  updateTenantUser,
  assignUserRole,
  reactivateTenantUser,
} from '@/lib/api/admin-users'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const roles: AdminRole[] = [
  { id: 'r1', name: 'admin', permissions: [] },
  { id: 'r2', name: 'member', permissions: [] },
]

const makeUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: 'user-1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  locale: 'pt-BR',
  timezone: 'UTC',
  is_active: true,
  role: { id: 'r1', name: 'admin' },
  system_role: 'user',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

// ---------------------------------------------------------------------------
// InviteDrawer tests
// ---------------------------------------------------------------------------

describe('InviteDrawer', () => {
  beforeEach(() => {
    vi.mocked(createTenantUser).mockResolvedValue(makeUser())
  })

  it('calls createTenantUser with correct args and triggers onInvited', async () => {
    const user = userEvent.setup()
    const onInvited = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <InviteDrawer
        open
        onOpenChange={onOpenChange}
        roles={roles}
        tenant="t1"
        onInvited={onInvited}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Bob Builder')
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'bob@example.com')
    await user.type(screen.getByLabelText(/password/i), 'secure123')

    await user.click(screen.getByRole('button', { name: /send invite/i }))

    await waitFor(() =>
      expect(createTenantUser).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          name: 'Bob Builder',
          email: 'bob@example.com',
          password: 'secure123',
          role_id: 'r1',
          locale: 'pt-BR',
        }),
      ),
    )

    expect(onInvited).toHaveBeenCalled()
  })

  it('disables Save when password is shorter than 8 chars', () => {
    render(
      <InviteDrawer
        open
        onOpenChange={vi.fn()}
        roles={roles}
        tenant="t1"
        onInvited={vi.fn()}
      />,
    )
    // No inputs filled — button should be disabled
    expect(screen.getByRole('button', { name: /send invite/i })).toBeDisabled()
  })

  it('shows password min length hint when password < 8 chars', async () => {
    const user = userEvent.setup()
    render(
      <InviteDrawer
        open
        onOpenChange={vi.fn()}
        roles={roles}
        tenant="t1"
        onInvited={vi.fn()}
      />,
    )
    await user.type(screen.getByLabelText(/password/i), 'short')
    expect(screen.getByText(/minimum 8 characters/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// EditDrawer smoke test
// ---------------------------------------------------------------------------

describe('EditDrawer', () => {
  beforeEach(() => {
    vi.mocked(updateTenantUser).mockResolvedValue(makeUser())
    vi.mocked(assignUserRole).mockResolvedValue(undefined as unknown as void)
  })

  it('pre-fills fields from user and calls updateTenantUser on save', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const target = makeUser()

    render(
      <EditDrawer
        open
        onOpenChange={vi.fn()}
        user={target}
        roles={roles}
        tenant="t1"
        onSaved={onSaved}
      />,
    )

    // Name field should be pre-filled
    expect(screen.getByDisplayValue('Alice Smith')).toBeInTheDocument()

    // Clear name and type new value
    await user.clear(screen.getByDisplayValue('Alice Smith'))
    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Alice Updated')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(updateTenantUser).toHaveBeenCalledWith(
        'user-1',
        't1',
        expect.objectContaining({ name: 'Alice Updated', email: 'alice@example.com' }),
      ),
    )

    expect(onSaved).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// ReactivateDrawer smoke test
// ---------------------------------------------------------------------------

describe('ReactivateDrawer', () => {
  beforeEach(() => {
    vi.mocked(reactivateTenantUser).mockResolvedValue(makeUser({ is_active: true }))
  })

  it('calls reactivateTenantUser and triggers onReactivated', async () => {
    const user = userEvent.setup()
    const onReactivated = vi.fn()
    const target = makeUser({ is_active: false })

    render(
      <ReactivateDrawer
        open
        onOpenChange={vi.fn()}
        user={target}
        roles={roles}
        tenant="t1"
        onReactivated={onReactivated}
      />,
    )

    await user.click(screen.getByRole('button', { name: /reactivate/i }))

    await waitFor(() =>
      expect(reactivateTenantUser).toHaveBeenCalledWith('user-1', 't1', 'r1'),
    )

    expect(onReactivated).toHaveBeenCalled()
  })
})
