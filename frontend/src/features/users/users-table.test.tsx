import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import '@/lib/i18n/index'

import { UsersTable } from './users-table'
import type { AdminUser } from '@/lib/api/admin-users'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: 'user-1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  locale: 'en',
  timezone: 'UTC',
  is_active: true,
  role: { id: 'role-1', name: 'admin' },
  system_role: 'user',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

const userAlice = makeUser({ id: 'user-1', name: 'Alice Smith', email: 'alice@example.com' })
const userBob = makeUser({
  id: 'user-2',
  name: 'Bob Jones',
  email: 'bob@example.com',
  system_role: 'user',
})

const defaultProps = {
  users: [userAlice, userBob],
  tab: 'active' as const,
  canUpdate: true,
  canDelete: false,
  isPlatformAdmin: false,
  currentUserId: 'other-user',
  onEdit: vi.fn(),
  onDeactivate: vi.fn(),
  onReactivate: vi.fn(),
  onToggleSystemRole: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UsersTable', () => {
  it('renders both user names', () => {
    render(<UsersTable {...defaultProps} />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
  })

  it('renders both user emails', () => {
    render(<UsersTable {...defaultProps} />)
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
  })

  it('calls onEdit with the correct user when Edit button is clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<UsersTable {...defaultProps} onEdit={onEdit} />)

    const editButtons = screen.getAllByTitle('Edit user')
    await user.click(editButtons[0])

    expect(onEdit).toHaveBeenCalledOnce()
    expect(onEdit).toHaveBeenCalledWith(userAlice)
  })

  it('does not render an actions column when canUpdate and canDelete are false', () => {
    render(
      <UsersTable
        {...defaultProps}
        canUpdate={false}
        canDelete={false}
        isPlatformAdmin={false}
      />,
    )
    expect(screen.queryByTitle('Edit user')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Deactivate')).not.toBeInTheDocument()
  })

  it('renders a Deactivate button when canDelete is true (active tab)', async () => {
    const user = userEvent.setup()
    const onDeactivate = vi.fn()
    render(
      <UsersTable
        {...defaultProps}
        canDelete={true}
        onDeactivate={onDeactivate}
      />,
    )

    const deactivateButtons = screen.getAllByTitle('Deactivate')
    await user.click(deactivateButtons[0])

    expect(onDeactivate).toHaveBeenCalledOnce()
    expect(onDeactivate).toHaveBeenCalledWith(userAlice)
  })

  it('does not render actions for the current user', () => {
    render(
      <UsersTable
        {...defaultProps}
        currentUserId={userAlice.id}
      />,
    )
    // Alice is the current user — her row should have no Edit button
    // Bob should still have one
    const editButtons = screen.getAllByTitle('Edit user')
    expect(editButtons).toHaveLength(1)
  })

  it('renders Reactivate button on inactive tab', async () => {
    const user = userEvent.setup()
    const onReactivate = vi.fn()
    const inactiveUser = makeUser({ id: 'user-3', name: 'Carol Lee', is_active: false })
    render(
      <UsersTable
        {...defaultProps}
        users={[inactiveUser]}
        tab='inactive'
        canUpdate={true}
        onReactivate={onReactivate}
      />,
    )

    const reactivateBtn = screen.getByTitle('Reactivate User')
    await user.click(reactivateBtn)

    expect(onReactivate).toHaveBeenCalledOnce()
    expect(onReactivate).toHaveBeenCalledWith(inactiveUser)
  })

  it('does not render actions on inactive tab when canUpdate is false', () => {
    const inactiveUser = makeUser({ id: 'user-3', name: 'Carol Lee', is_active: false })
    render(
      <UsersTable
        {...defaultProps}
        users={[inactiveUser]}
        tab='inactive'
        canUpdate={false}
      />,
    )
    expect(screen.queryByTitle('Reactivate User')).not.toBeInTheDocument()
  })

  it('renders platform admin toggle buttons when isPlatformAdmin is true', async () => {
    const user = userEvent.setup()
    const onToggleSystemRole = vi.fn()
    render(
      <UsersTable
        {...defaultProps}
        isPlatformAdmin={true}
        onToggleSystemRole={onToggleSystemRole}
      />,
    )

    // Both users have system_role: 'user' → title should be 'Grant platform admin'
    const grantButtons = screen.getAllByTitle('Grant platform admin')
    expect(grantButtons.length).toBeGreaterThan(0)

    await user.click(grantButtons[0])
    expect(onToggleSystemRole).toHaveBeenCalledOnce()
    expect(onToggleSystemRole).toHaveBeenCalledWith(userAlice)
  })
})
