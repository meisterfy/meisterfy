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

// ── API mocks ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/api/mcp-keys', () => ({
  listMcpKeys: vi.fn(),
  createMcpKey: vi.fn(),
  revokeMcpKey: vi.fn(),
}))

// ── sonner mock ───────────────────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ── Clipboard stub (jsdom does not implement navigator.clipboard) ─────────────
// navigator.clipboard is undefined in jsdom. We stub it once here so any test
// that exercises copy() does not throw "Cannot read properties of undefined".
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
  writable: true,
})

// ── Imports after mocks ───────────────────────────────────────────────────────
import React from 'react'
import { listMcpKeys, createMcpKey, revokeMcpKey } from '@/lib/api/mcp-keys'
import type { McpApiKey, CreateMcpKeyResponse } from '@/lib/api/mcp-keys'
import { toast } from 'sonner'
import { McpRoute } from './mcp'

const mockListMcpKeys = vi.mocked(listMcpKeys)
const mockCreateMcpKey = vi.mocked(createMcpKey)
const mockRevokeMcpKey = vi.mocked(revokeMcpKey)
const mockToast = vi.mocked(toast)

// ── Fixtures ──────────────────────────────────────────────────────────────────
const KEY_READONLY: McpApiKey = {
  id: 'k1',
  name: 'CI Key',
  role: 'readonly',
  key_prefix: 'mcp_ci',
  created_at: '2024-01-15T10:00:00Z',
  last_used_at: '2024-01-20T08:00:00Z',
  expires_at: null,
}

const KEY_ADMIN: McpApiKey = {
  id: 'k2',
  name: 'Admin Key',
  role: 'admin',
  key_prefix: 'mcp_adm',
  created_at: '2024-02-01T09:00:00Z',
  last_used_at: null,
  expires_at: '2025-01-01T00:00:00Z',
}

const CREATED_KEY_RESPONSE: CreateMcpKeyResponse = {
  ...KEY_READONLY,
  id: 'k3',
  name: 'New Key',
  role: 'readonly',
  key_prefix: 'mcp_new',
  key: 'mcp_live_supersecretkey123',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderRoute() {
  return render(<McpRoute />)
}

function setUser(permissions: string[] = []) {
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

function setManagerUser() {
  setUser(['manage:mcp-keys'])
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

// ── Tests — initial load ──────────────────────────────────────────────────────

describe('McpRoute — initial load', () => {
  it('shows the settings skeleton while loading', () => {
    mockListMcpKeys.mockReturnValue(new Promise(() => {}))

    renderRoute()

    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })

  it('renders key rows after loading resolves', async () => {
    mockListMcpKeys.mockResolvedValue([KEY_READONLY, KEY_ADMIN])

    renderRoute()

    // Key names appear in the table
    expect(await screen.findByText('CI Key')).toBeInTheDocument()
    expect(screen.getByText('Admin Key')).toBeInTheDocument()
  })

  it('renders role badge with roleLabel text', async () => {
    mockListMcpKeys.mockResolvedValue([KEY_READONLY, KEY_ADMIN])

    renderRoute()

    await screen.findByText('CI Key')

    // t stub returns 'settings:mcp_role_readonly' and 'settings:mcp_role_admin'
    expect(screen.getByText('settings:mcp_role_readonly')).toBeInTheDocument()
    expect(screen.getByText('settings:mcp_role_admin')).toBeInTheDocument()
  })

  it('renders key_prefix with trailing ellipsis', async () => {
    mockListMcpKeys.mockResolvedValue([KEY_READONLY])

    renderRoute()

    await screen.findByText('CI Key')

    expect(screen.getByText('mcp_ci…')).toBeInTheDocument()
  })

  it('renders formatted dates in the table', async () => {
    mockListMcpKeys.mockResolvedValue([KEY_ADMIN])

    renderRoute()

    await screen.findByText('Admin Key')

    // expires_at is set on KEY_ADMIN — should show a date string (not 'mcp_never')
    // last_used_at is null — should show 'settings:mcp_never'
    const neverEls = screen.getAllByText('settings:mcp_never')
    expect(neverEls.length).toBeGreaterThan(0)
  })

  it('calls listMcpKeys with the tenant id on mount', async () => {
    mockListMcpKeys.mockResolvedValue([])

    renderRoute()

    await waitFor(() => {
      expect(mockListMcpKeys).toHaveBeenCalledWith('acme')
    })
  })
})

// ── Tests — empty state ───────────────────────────────────────────────────────

describe('McpRoute — empty state', () => {
  it('shows empty state when no keys returned', async () => {
    mockListMcpKeys.mockResolvedValue([])

    renderRoute()

    await waitFor(() => {
      expect(screen.getByText('settings:mcp_empty')).toBeInTheDocument()
    })
  })

  it('does not show the table when keys is empty', async () => {
    mockListMcpKeys.mockResolvedValue([])

    renderRoute()

    await screen.findByText('settings:mcp_empty')

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows New Key button in empty state when user has manage:mcp-keys', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([])

    renderRoute()

    await screen.findByText('settings:mcp_empty')

    // There should be at least one button containing mcp_new_key text
    const btns = screen.getAllByRole('button')
    const newKeyBtns = btns.filter((b) => b.textContent?.includes('settings:mcp_new_key'))
    expect(newKeyBtns.length).toBeGreaterThan(0)
  })

  it('does not show New Key button in empty state without manage:mcp-keys', async () => {
    setUser([]) // no manage:mcp-keys
    mockListMcpKeys.mockResolvedValue([])

    renderRoute()

    await screen.findByText('settings:mcp_empty')

    // The SectionTitle new-key button is not rendered when canManage=false
    // Look for mcp_new_key text — should not be present
    expect(screen.queryByText(/settings:mcp_new_key/)).not.toBeInTheDocument()
  })
})

// ── Tests — canManage (SectionTitle button + revoke column) ───────────────────

describe('McpRoute — canManage', () => {
  it('shows the New key button in SectionTitle when user has manage:mcp-keys', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([KEY_READONLY])

    renderRoute()

    await screen.findByText('CI Key')

    const btns = screen.getAllByRole('button')
    const newKeyBtns = btns.filter((b) => b.textContent?.includes('settings:mcp_new_key'))
    expect(newKeyBtns.length).toBeGreaterThan(0)
  })

  it('hides the New key button when user lacks manage:mcp-keys', async () => {
    setUser([])
    mockListMcpKeys.mockResolvedValue([KEY_READONLY])

    renderRoute()

    await screen.findByText('CI Key')

    expect(screen.queryByText(/settings:mcp_new_key/)).not.toBeInTheDocument()
  })

  it('shows the revoke button per row when user has manage:mcp-keys', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([KEY_READONLY, KEY_ADMIN])

    renderRoute()

    await screen.findByText('CI Key')

    const revokeButtons = screen.getAllByText('settings:mcp_revoke')
    expect(revokeButtons).toHaveLength(2)
  })

  it('hides the revoke button when user lacks manage:mcp-keys', async () => {
    setUser([])
    mockListMcpKeys.mockResolvedValue([KEY_READONLY])

    renderRoute()

    await screen.findByText('CI Key')

    expect(screen.queryByText('settings:mcp_revoke')).not.toBeInTheDocument()
  })
})

// ── Tests — create dialog ─────────────────────────────────────────────────────

describe('McpRoute — create dialog', () => {
  it('clicking New key opens the create dialog', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([])

    renderRoute()

    await screen.findByText('settings:mcp_empty')

    // Click the New key button (may have multiple — take first)
    const btns = screen.getAllByRole('button')
    const newKeyBtn = btns.find((b) => b.textContent?.includes('settings:mcp_new_key'))
    expect(newKeyBtn).toBeDefined()
    fireEvent.click(newKeyBtn!)

    // Dialog should appear with create title
    await waitFor(() => {
      expect(screen.getByText('settings:mcp_create_title')).toBeInTheDocument()
    })
  })

  it('submitting the form calls createMcpKey with trimmed name + role', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([])
    mockCreateMcpKey.mockResolvedValue(CREATED_KEY_RESPONSE)

    renderRoute()

    await screen.findByText('settings:mcp_empty')

    // Open dialog
    const btns = screen.getAllByRole('button')
    const newKeyBtn = btns.find((b) => b.textContent?.includes('settings:mcp_new_key'))
    fireEvent.click(newKeyBtn!)

    await waitFor(() => {
      expect(screen.getByText('settings:mcp_create_title')).toBeInTheDocument()
    })

    // Fill the name field
    const nameInput = screen.getByPlaceholderText('settings:mcp_create_field_name_placeholder')
    fireEvent.change(nameInput, { target: { value: '  New Key  ' } })

    // Submit
    const submitBtn = screen.getByText('settings:mcp_create_submit').closest('button')
    await act(async () => {
      fireEvent.click(submitBtn!)
    })

    await waitFor(() => {
      expect(mockCreateMcpKey).toHaveBeenCalledWith('acme', {
        name: 'New Key',
        role: 'readonly',
      })
    })
  })

  it('submitting with an expires_at date includes it in the call', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([])
    mockCreateMcpKey.mockResolvedValue(CREATED_KEY_RESPONSE)

    renderRoute()

    await screen.findByText('settings:mcp_empty')

    const btns = screen.getAllByRole('button')
    const newKeyBtn = btns.find((b) => b.textContent?.includes('settings:mcp_new_key'))
    fireEvent.click(newKeyBtn!)

    await waitFor(() => {
      expect(screen.getByText('settings:mcp_create_title')).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText('settings:mcp_create_field_name_placeholder')
    fireEvent.change(nameInput, { target: { value: 'Expiring Key' } })

    // Set a date value
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2025-12-31' } })

    const submitBtn = screen.getByText('settings:mcp_create_submit').closest('button')
    await act(async () => {
      fireEvent.click(submitBtn!)
    })

    await waitFor(() => {
      expect(mockCreateMcpKey).toHaveBeenCalledWith(
        'acme',
        expect.objectContaining({
          name: 'Expiring Key',
          role: 'readonly',
          expires_at: new Date('2025-12-31').toISOString(),
        }),
      )
    })
  })

  it('shows the created-key reveal panel with the raw key after success', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([])
    mockCreateMcpKey.mockResolvedValue(CREATED_KEY_RESPONSE)

    renderRoute()

    await screen.findByText('settings:mcp_empty')

    const btns = screen.getAllByRole('button')
    const newKeyBtn = btns.find((b) => b.textContent?.includes('settings:mcp_new_key'))
    fireEvent.click(newKeyBtn!)

    await waitFor(() => {
      expect(screen.getByText('settings:mcp_create_title')).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText('settings:mcp_create_field_name_placeholder')
    fireEvent.change(nameInput, { target: { value: 'New Key' } })

    const submitBtn = screen.getByText('settings:mcp_create_submit').closest('button')
    await act(async () => {
      fireEvent.click(submitBtn!)
    })

    // Reveal panel should now show the raw key
    await waitFor(() => {
      expect(screen.getByText(CREATED_KEY_RESPONSE.key)).toBeInTheDocument()
    })

    // Dialog title should switch to created title
    expect(screen.getByText('settings:mcp_created_title')).toBeInTheDocument()
  })

  it('shows an error message when createMcpKey throws', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([])
    mockCreateMcpKey.mockRejectedValue(new Error('network error'))

    renderRoute()

    await screen.findByText('settings:mcp_empty')

    const btns = screen.getAllByRole('button')
    const newKeyBtn = btns.find((b) => b.textContent?.includes('settings:mcp_new_key'))
    fireEvent.click(newKeyBtn!)

    await waitFor(() => {
      expect(screen.getByText('settings:mcp_create_title')).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText('settings:mcp_create_field_name_placeholder')
    fireEvent.change(nameInput, { target: { value: 'New Key' } })

    const submitBtn = screen.getByText('settings:mcp_create_submit').closest('button')
    await act(async () => {
      fireEvent.click(submitBtn!)
    })

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  it('done button reloads the key list and closes dialog', async () => {
    setManagerUser()
    mockListMcpKeys
      .mockResolvedValueOnce([]) // initial load
      .mockResolvedValueOnce([{ ...CREATED_KEY_RESPONSE }]) // after done
    mockCreateMcpKey.mockResolvedValue(CREATED_KEY_RESPONSE)

    renderRoute()

    await screen.findByText('settings:mcp_empty')

    const btns = screen.getAllByRole('button')
    const newKeyBtn = btns.find((b) => b.textContent?.includes('settings:mcp_new_key'))
    fireEvent.click(newKeyBtn!)

    await waitFor(() => {
      expect(screen.getByText('settings:mcp_create_title')).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText('settings:mcp_create_field_name_placeholder')
    fireEvent.change(nameInput, { target: { value: 'New Key' } })

    const submitBtn = screen.getByText('settings:mcp_create_submit').closest('button')
    await act(async () => {
      fireEvent.click(submitBtn!)
    })

    await waitFor(() => {
      expect(screen.getByText('settings:mcp_created_title')).toBeInTheDocument()
    })

    const doneBtn = screen.getByText('settings:mcp_created_done').closest('button')
    await act(async () => {
      fireEvent.click(doneBtn!)
    })

    // listMcpKeys should have been called again after done
    await waitFor(() => {
      expect(mockListMcpKeys).toHaveBeenCalledTimes(2)
    })
  })
})

// ── Tests — revoke dialog ─────────────────────────────────────────────────────

describe('McpRoute — revoke dialog', () => {
  it('clicking the revoke button opens the confirm dialog', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([KEY_READONLY])

    renderRoute()

    await screen.findByText('CI Key')

    const revokeBtn = screen.getByText('settings:mcp_revoke')
    fireEvent.click(revokeBtn)

    await waitFor(() => {
      expect(screen.getByText('settings:mcp_revoke_title')).toBeInTheDocument()
    })
  })

  it('confirming revoke calls revokeMcpKey and removes the row', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([KEY_READONLY, KEY_ADMIN])
    mockRevokeMcpKey.mockResolvedValue(undefined as unknown as void)

    renderRoute()

    await screen.findByText('CI Key')

    // Click the first revoke button (CI Key)
    const revokeBtns = screen.getAllByText('settings:mcp_revoke')
    fireEvent.click(revokeBtns[0])

    await waitFor(() => {
      expect(screen.getByText('settings:mcp_revoke_title')).toBeInTheDocument()
    })

    // The confirm dialog button has confirmLabel = 'settings:mcp_revoke_confirm'
    const confirmBtn = screen.getByText('settings:mcp_revoke_confirm').closest('button')
    await act(async () => {
      fireEvent.click(confirmBtn!)
    })

    await waitFor(() => {
      expect(mockRevokeMcpKey).toHaveBeenCalledWith('acme', KEY_READONLY.id)
    })

    // The revoked row should be removed
    await waitFor(() => {
      expect(screen.queryByText('CI Key')).not.toBeInTheDocument()
    })

    // Admin Key row should still be present
    expect(screen.getByText('Admin Key')).toBeInTheDocument()
  })

  it('successful revoke shows a success toast', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([KEY_READONLY])
    mockRevokeMcpKey.mockResolvedValue(undefined as unknown as void)

    renderRoute()

    await screen.findByText('CI Key')

    const revokeBtn = screen.getByText('settings:mcp_revoke')
    fireEvent.click(revokeBtn)

    await waitFor(() => {
      expect(screen.getByText('settings:mcp_revoke_title')).toBeInTheDocument()
    })

    const confirmBtn = screen.getByText('settings:mcp_revoke_confirm').closest('button')
    await act(async () => {
      fireEvent.click(confirmBtn!)
    })

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('settings:mcp_revoke_confirm')
    })
  })

  it('failed revoke shows an error toast', async () => {
    setManagerUser()
    mockListMcpKeys.mockResolvedValue([KEY_READONLY])
    mockRevokeMcpKey.mockRejectedValue(new Error('server error'))

    renderRoute()

    await screen.findByText('CI Key')

    const revokeBtn = screen.getByText('settings:mcp_revoke')
    fireEvent.click(revokeBtn)

    await waitFor(() => {
      expect(screen.getByText('settings:mcp_revoke_title')).toBeInTheDocument()
    })

    const confirmBtn = screen.getByText('settings:mcp_revoke_confirm').closest('button')
    await act(async () => {
      fireEvent.click(confirmBtn!)
    })

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to revoke key')
    })
  })
})
