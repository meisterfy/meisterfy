import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAuth } from '../../../store/auth'

// ── Router mock ───────────────────────────────────────────────────────────────
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    createFileRoute: (_path: string) => (opts: { beforeLoad?: () => void; component: unknown }) => ({
      ...opts,
      useParams: () => ({ tenant: 'acme' }),
    }),
    redirect: original.redirect,
  }
})

// ── i18n mock ─────────────────────────────────────────────────────────────────
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (ns?: string) => ({
      t: (key: string, params?: Record<string, unknown>) => {
        const base = ns ? `${ns}:${key}` : key
        if (params) {
          return Object.entries(params).reduce(
            (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
            base,
          )
        }
        return base
      },
    }),
  }
})

// ── API mock ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/api/admin-users', () => ({
  listRoles: vi.fn(),
  listPermissions: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
}))

// ── sonner mock ───────────────────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import React from 'react'
import { listRoles, listPermissions, createRole, updateRole, deleteRole } from '@/lib/api/admin-users'
import type { AdminRole, AdminPermission } from '@/lib/api/admin-users'
import { toast } from 'sonner'
import { RolesRoute } from './-roles'

const mockListRoles = vi.mocked(listRoles)
const mockListPermissions = vi.mocked(listPermissions)
const mockCreateRole = vi.mocked(createRole)
const mockUpdateRole = vi.mocked(updateRole)
const mockDeleteRole = vi.mocked(deleteRole)
const mockToast = vi.mocked(toast)

// ── Fixtures ──────────────────────────────────────────────────────────────────
const SYSTEM_ROLE: AdminRole = {
  id: 'r-system',
  name: 'owner',
  tenant_id: null, // system role: no tenant_id
  permissions: ['create:user', 'update:user', 'delete:user'],
}

const CUSTOM_ROLE: AdminRole = {
  id: 'r-custom',
  name: 'editor',
  tenant_id: 'acme',
  permissions: ['create:post'],
}

const PERMISSIONS: AdminPermission[] = [
  { id: 'p1', name: 'create:user' },
  { id: 'p2', name: 'update:user' },
  { id: 'p3', name: 'delete:user' },
  { id: 'p4', name: 'create:post' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderRoute() {
  return render(<RolesRoute />)
}

function setUser(permissions: string[] = ['create:role', 'update:role', 'delete:role']) {
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
  setUser()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests — loading + auto-select ─────────────────────────────────────────────

describe('RolesRoute — loading and auto-select', () => {
  it('shows the settings skeleton while loading', () => {
    mockListRoles.mockReturnValue(new Promise(() => {}))
    mockListPermissions.mockReturnValue(new Promise(() => {}))

    renderRoute()

    // SettingsSkeleton renders with animate-pulse during loading
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })

  it('auto-selects the first role after data loads and shows it in the detail card', async () => {
    mockListRoles.mockResolvedValue([SYSTEM_ROLE, CUSTOM_ROLE])
    mockListPermissions.mockResolvedValue(PERMISSIONS)

    renderRoute()

    // Wait for data to load and auto-select to happen.
    // The system-role note only appears in the detail card when the role is selected.
    await waitFor(() => {
      expect(screen.getByText('settings:roles_system_cannot_modify')).toBeInTheDocument()
    })
  })

  it('auto-selected system role renders its permission groups in the detail card', async () => {
    mockListRoles.mockResolvedValue([SYSTEM_ROLE, CUSTOM_ROLE])
    mockListPermissions.mockResolvedValue(PERMISSIONS)

    renderRoute()

    // Wait for detail card to render (system role note is the signal)
    await waitFor(() => {
      expect(screen.getByText('settings:roles_system_cannot_modify')).toBeInTheDocument()
    })

    // groupPermissions calls t('settings:roles_perm_group_users'), and the mock
    // t function prefixes the ns 'settings', yielding 'settings:settings:roles_perm_group_users'.
    // The 'users' group matches create:user, update:user, delete:user — all present.
    expect(
      screen.getByText('settings:settings:roles_perm_group_users'),
    ).toBeInTheDocument()
  })

  it('renders the section title after data loads', async () => {
    mockListRoles.mockResolvedValue([CUSTOM_ROLE])
    mockListPermissions.mockResolvedValue(PERMISSIONS)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText('settings:roles_title')).toBeInTheDocument()
    })
  })
})

// ── Tests — system role ───────────────────────────────────────────────────────

describe('RolesRoute — system role behaviour', () => {
  it('shows the cannot-modify note for a system role', async () => {
    mockListRoles.mockResolvedValue([SYSTEM_ROLE])
    mockListPermissions.mockResolvedValue(PERMISSIONS)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText('settings:roles_system_cannot_modify')).toBeInTheDocument()
    })
  })

  it('renders disabled checkboxes for a system role (not editable)', async () => {
    mockListRoles.mockResolvedValue([SYSTEM_ROLE])
    mockListPermissions.mockResolvedValue(PERMISSIONS)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText('settings:roles_system_cannot_modify')).toBeInTheDocument()
    })

    // All checkboxes should be disabled for a system role
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach((cb) => {
      expect(cb).toBeDisabled()
    })
  })

  it('does not show Save or Delete buttons for a system role', async () => {
    mockListRoles.mockResolvedValue([SYSTEM_ROLE])
    mockListPermissions.mockResolvedValue(PERMISSIONS)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText('settings:roles_system_cannot_modify')).toBeInTheDocument()
    })

    // Save and Delete buttons should not be present for system roles
    expect(screen.queryByText('settings:roles_save_changes')).not.toBeInTheDocument()
    // The delete button has literal "Delete" text with a space — system roles should not show it
    expect(
      screen.queryByRole('button', { name: /delete/i }),
    ).not.toBeInTheDocument()
  })
})

// ── Tests — custom role permissions toggle ────────────────────────────────────

describe('RolesRoute — custom role perm toggle', () => {
  it('toggling a permission enables the Save button (hasPendingChanges)', async () => {
    // Only custom role — detail card is editable, no system note
    mockListRoles.mockResolvedValue([CUSTOM_ROLE])
    mockListPermissions.mockResolvedValue(PERMISSIONS)

    renderRoute()

    // Wait for the role detail to load — the role name appears in the name input
    await waitFor(() => {
      // When a custom role is selected and user has update:role, an Input renders
      // with the role name as value (pendingName = role.name)
      const input = screen.getByDisplayValue(CUSTOM_ROLE.name)
      expect(input).toBeInTheDocument()
    })

    // Checkboxes should now be rendered (CUSTOM_ROLE has canUpdate=true)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)

    // Toggle an unchecked permission — create:user, create:post is checked;
    // create:user is NOT in CUSTOM_ROLE.permissions so it renders as unchecked
    const unchecked = checkboxes.find((cb) => !(cb as HTMLInputElement).checked)
    expect(unchecked).toBeDefined()

    fireEvent.click(unchecked!)

    // Save button should now appear (hasPendingChanges)
    await waitFor(() => {
      expect(screen.getByText('settings:roles_save_changes')).toBeInTheDocument()
    })
  })

  it('clicking Save calls updateRole with pending name and permissions', async () => {
    mockListRoles.mockResolvedValue([CUSTOM_ROLE])
    mockListPermissions.mockResolvedValue(PERMISSIONS)
    mockUpdateRole.mockResolvedValue({
      ...CUSTOM_ROLE,
      permissions: ['create:post', 'create:user'],
    })

    renderRoute()

    // Wait for the role detail card to render with an editable input
    await waitFor(() => {
      expect(screen.getByDisplayValue(CUSTOM_ROLE.name)).toBeInTheDocument()
    })

    // Toggle a permission to create a change
    const checkboxes = screen.getAllByRole('checkbox')
    const unchecked = checkboxes.find((cb) => !(cb as HTMLInputElement).checked)
    fireEvent.click(unchecked!)

    // Wait for save button to appear
    await waitFor(() => {
      expect(screen.getByText('settings:roles_save_changes')).toBeInTheDocument()
    })

    const saveBtn = screen.getByText('settings:roles_save_changes').closest('button')
    expect(saveBtn).not.toBeNull()

    await act(async () => {
      fireEvent.click(saveBtn!)
    })

    await waitFor(() => {
      expect(mockUpdateRole).toHaveBeenCalledWith(
        CUSTOM_ROLE.id,
        expect.objectContaining({
          name: CUSTOM_ROLE.name,
          permissions: expect.arrayContaining(['create:post']),
        }),
      )
    })

    expect(mockToast.success).toHaveBeenCalledWith('settings:roles_toast_saved')
  })
})

// ── Tests — create role ───────────────────────────────────────────────────────

describe('RolesRoute — create role', () => {
  it('shows the New Role button when user has create:role permission', async () => {
    setUser(['create:role'])
    mockListRoles.mockResolvedValue([])
    mockListPermissions.mockResolvedValue(PERMISSIONS)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText('settings:roles_title')).toBeInTheDocument()
    })

    expect(screen.getByText('settings:roles_new_role')).toBeInTheDocument()
  })

  it('hides the New Role button when user lacks create:role permission', async () => {
    setUser([]) // no permissions
    mockListRoles.mockResolvedValue([])
    mockListPermissions.mockResolvedValue(PERMISSIONS)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText('settings:roles_title')).toBeInTheDocument()
    })

    expect(screen.queryByText('settings:roles_new_role')).not.toBeInTheDocument()
  })

  it('clicking New Role opens the create drawer', async () => {
    setUser(['create:role'])
    mockListRoles.mockResolvedValue([])
    mockListPermissions.mockResolvedValue(PERMISSIONS)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText('settings:roles_new_role')).toBeInTheDocument()
    })

    const newRoleBtn = screen.getByText('settings:roles_new_role').closest('button')
    fireEvent.click(newRoleBtn!)

    // The drawer renders TWO elements with the create title:
    //   - one sr-only <h2> (the Drawer's accessible title in headerless mode)
    //   - one visible <h2> in the custom header we render
    // Use getAllByText and assert at least one is visible.
    await waitFor(() => {
      const titleEls = screen.getAllByText('settings:roles_create_title')
      expect(titleEls.length).toBeGreaterThan(0)
    })
  })

  it('submitting the create drawer calls createRole and toasts', async () => {
    setUser(['create:role'])
    const newRole: AdminRole = {
      id: 'r-new',
      name: 'my-custom',
      tenant_id: 'acme',
      permissions: [],
    }
    mockListRoles.mockResolvedValue([])
    mockListPermissions.mockResolvedValue(PERMISSIONS)
    mockCreateRole.mockResolvedValue(newRole)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText('settings:roles_new_role')).toBeInTheDocument()
    })

    const newRoleBtn = screen.getByText('settings:roles_new_role').closest('button')
    fireEvent.click(newRoleBtn!)

    // Wait for drawer to open (multiple elements with the title is expected)
    await waitFor(() => {
      const titleEls = screen.getAllByText('settings:roles_create_title')
      expect(titleEls.length).toBeGreaterThan(0)
    })

    // Find the name input by placeholder text
    const nameInput = screen.getByPlaceholderText('settings:roles_create_name_placeholder')
    fireEvent.change(nameInput, { target: { value: 'My Custom' } })

    // Submit — find by the submit text
    const submitBtn = screen.getByText('settings:roles_create_submit').closest('button')
    await act(async () => {
      fireEvent.click(submitBtn!)
    })

    await waitFor(() => {
      expect(mockCreateRole).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Custom',
          permissions: [],
        }),
      )
    })

    expect(mockToast.success).toHaveBeenCalledWith('settings:roles_toast_created')
  })
})

// ── Tests — delete role ───────────────────────────────────────────────────────

describe('RolesRoute — delete role', () => {
  it('clicking Delete on a custom role opens the confirm dialog', async () => {
    setUser(['delete:role'])
    mockListRoles.mockResolvedValue([CUSTOM_ROLE])
    mockListPermissions.mockResolvedValue(PERMISSIONS)

    renderRoute()

    // Wait for the detail card to render. The Delete button is the signal
    // (only appears in the detail card when canDelete=true and !isSystem).
    // Use findByRole which retries internally.
    const deleteBtn = await screen.findByRole('button', { name: /delete/i })
    expect(deleteBtn).toBeInTheDocument()

    fireEvent.click(deleteBtn)

    // Confirm dialog title should appear
    await waitFor(() => {
      expect(screen.getByText('settings:roles_delete_title')).toBeInTheDocument()
    })
  })

  it('confirming delete calls deleteRole and removes the role', async () => {
    setUser(['delete:role'])
    mockListRoles.mockResolvedValue([CUSTOM_ROLE])
    mockListPermissions.mockResolvedValue(PERMISSIONS)
    mockDeleteRole.mockResolvedValue(undefined as unknown as void)

    renderRoute()

    // Wait for the Delete button to appear in the detail card
    const deleteBtn = await screen.findByRole('button', { name: /delete/i })
    expect(deleteBtn).toBeInTheDocument()
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText('settings:roles_delete_title')).toBeInTheDocument()
    })

    // Click the confirm button in the dialog
    const confirmBtn = screen.getByText('settings:roles_delete_confirm_btn').closest('button')
    await act(async () => {
      fireEvent.click(confirmBtn!)
    })

    await waitFor(() => {
      expect(mockDeleteRole).toHaveBeenCalledWith(CUSTOM_ROLE.id)
    })

    expect(mockToast.success).toHaveBeenCalledWith('settings:roles_toast_deleted')
  })
})
