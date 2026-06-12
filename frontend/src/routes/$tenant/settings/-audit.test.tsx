import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
vi.mock('@/lib/api/audit-log', () => ({
  getAuditLog: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import React from 'react'
import { getAuditLog } from '@/lib/api/audit-log'
import { AuditRoute } from './-audit'

const mockGetAuditLog = vi.mocked(getAuditLog)

// ── Fixtures ──────────────────────────────────────────────────────────────────
const ENTRY_CREATED: import('@/lib/api/audit-log').AuditEntry = {
  id: 'e1',
  user_id: 'u1',
  user_name: 'Alice',
  action: 'user.created',
  entity_type: 'user',
  entity_id: 'u1',
  entity_name: 'Alice',
  before: null,
  after: { name: 'Alice', role: 'member' },
  created_at: '2024-03-15T14:30:00Z',
}

const ENTRY_UPDATED: import('@/lib/api/audit-log').AuditEntry = {
  id: 'e2',
  user_id: 'u1',
  user_name: 'Alice',
  action: 'user.updated',
  entity_type: 'user',
  entity_id: 'u2',
  entity_name: 'Bob',
  before: { name: 'Bob', role: 'viewer' },
  after: { name: 'Bob', role: 'admin' },
  created_at: '2024-03-16T10:00:00Z',
}

const ENTRY_NO_BEFORE: import('@/lib/api/audit-log').AuditEntry = {
  id: 'e3',
  user_id: 'u1',
  user_name: 'Alice',
  action: 'post.updated',
  entity_type: 'post',
  entity_id: 'p1',
  entity_name: null,
  before: null,
  after: { title: 'New Title' },
  created_at: '2024-03-17T08:00:00Z',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderRoute() {
  return render(<AuditRoute />)
}

function setUser() {
  useAuth.setState({
    token: 'tok',
    user: {
      id: 'u1',
      name: 'Alice',
      email: 'alice@test.com',
      tenant_id: 'acme',
      permissions: [],
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

// ── Tests — initial load ──────────────────────────────────────────────────────

describe('AuditRoute — initial load', () => {
  it('renders table rows from a mocked response after initialLoading resolves', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [ENTRY_CREATED, ENTRY_UPDATED], total: 2 })

    renderRoute()

    // Rows should appear once loading resolves — use findAllBy since "Alice" appears multiple
    // times (user_name column and entity_name span)
    const aliceEls = await screen.findAllByText('Alice')
    expect(aliceEls.length).toBeGreaterThan(0)
    expect(screen.getByText('user.created')).toBeInTheDocument()
    expect(screen.getByText('user.updated')).toBeInTheDocument()
  })

  it('shows the settings skeleton while loading', () => {
    // Never resolves — stays loading
    mockGetAuditLog.mockImplementation(() => new Promise(() => {}))

    renderRoute()

    // The animate-pulse skeleton wrapper should be present during loading
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })

  it('calls getAuditLog with the tenant id and PAGE_SIZE on mount', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [], total: 0 })

    renderRoute()

    await waitFor(() => {
      expect(mockGetAuditLog).toHaveBeenCalledWith(
        'acme',
        expect.objectContaining({ limit: 50, offset: 0 }),
      )
    })
  })

  it('renders entity_name when present', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [ENTRY_UPDATED], total: 1 })
    renderRoute()
    expect(await screen.findByText('Bob')).toBeInTheDocument()
  })

  it('renders entity_id in mono when entity_name is null', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [ENTRY_NO_BEFORE], total: 1 })
    renderRoute()
    // entity_name is null — entity_id 'p1' is rendered in mono
    expect(await screen.findByText('p1')).toBeInTheDocument()
  })
})

// ── Tests — Details button & drawer ──────────────────────────────────────────

describe('AuditRoute — Details button', () => {
  it('shows Details button for an entry with diffs and a non-.created action', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [ENTRY_UPDATED], total: 1 })
    renderRoute()

    const detailsBtn = await screen.findByRole('button', { name: /details/i })
    expect(detailsBtn).toBeInTheDocument()
  })

  it('does NOT show Details button for a .created action', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [ENTRY_CREATED], total: 1 })
    renderRoute()

    // Wait for rows to appear — use findAllBy since "Alice" appears in both user_name and entity_name
    await screen.findAllByText('Alice')

    expect(screen.queryByRole('button', { name: /details/i })).not.toBeInTheDocument()
  })

  it('does NOT show Details button when before is null', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [ENTRY_NO_BEFORE], total: 1 })
    renderRoute()

    await screen.findByText('p1')

    expect(screen.queryByRole('button', { name: /details/i })).not.toBeInTheDocument()
  })

  it('clicking Details opens the drawer and shows the diff', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [ENTRY_UPDATED], total: 1 })
    renderRoute()

    const detailsBtn = await screen.findByRole('button', { name: /details/i })
    fireEvent.click(detailsBtn)

    // The drawer renders two elements with the title: one sr-only (accessible name)
    // and one visible h2. Use getAllByText to handle both.
    await waitFor(() => {
      const titleEls = screen.getAllByText('settings:audit_details_title')
      expect(titleEls.length).toBeGreaterThan(0)
    })

    // The diff key 'role' should appear (changed from viewer -> admin)
    expect(screen.getByText('role')).toBeInTheDocument()
  })
})

// ── Tests — entity type filter ────────────────────────────────────────────────

describe('AuditRoute — entity type filter', () => {
  it('selecting an entity type triggers a getAuditLog re-call with entity_type', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [], total: 0 })
    renderRoute()

    // Wait for initial load to complete
    await waitFor(() => expect(mockGetAuditLog).toHaveBeenCalledTimes(1))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'user' } })

    await waitFor(() => {
      expect(mockGetAuditLog).toHaveBeenCalledTimes(2)
      expect(mockGetAuditLog).toHaveBeenLastCalledWith(
        'acme',
        expect.objectContaining({ entity_type: 'user', offset: 0 }),
      )
    })
  })
})

// ── Tests — pagination ────────────────────────────────────────────────────────

describe('AuditRoute — pagination', () => {
  it('renders pagination controls when total > PAGE_SIZE', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [ENTRY_UPDATED], total: 100 })
    renderRoute()

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /settings:globals:next|next/i }),
      ).toBeInTheDocument()
    })
  })

  it('does NOT render pagination when total <= PAGE_SIZE', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [ENTRY_UPDATED], total: 1 })
    renderRoute()

    await screen.findByText('Alice')

    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('clicking next calls getAuditLog with offset=50', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [ENTRY_UPDATED], total: 100 })
    renderRoute()

    // Wait for next button to appear
    const nextBtn = await screen.findByRole('button', { name: /globals:next/i })
    fireEvent.click(nextBtn)

    await waitFor(() => {
      expect(mockGetAuditLog).toHaveBeenCalledWith(
        'acme',
        expect.objectContaining({ offset: 50 }),
      )
    })
  })

  it('clicking prev calls getAuditLog with offset=0 after going to page 2', async () => {
    mockGetAuditLog.mockResolvedValue({ data: [ENTRY_UPDATED], total: 100 })
    renderRoute()

    const nextBtn = await screen.findByRole('button', { name: /globals:next/i })
    fireEvent.click(nextBtn)

    await waitFor(() =>
      expect(mockGetAuditLog).toHaveBeenCalledWith(
        'acme',
        expect.objectContaining({ offset: 50 }),
      ),
    )

    const prevBtn = screen.getByRole('button', { name: /globals:previous/i })
    fireEvent.click(prevBtn)

    await waitFor(() => {
      const calls = mockGetAuditLog.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[1]).toMatchObject({ offset: 0 })
    })
  })
})
