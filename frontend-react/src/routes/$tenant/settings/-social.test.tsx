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

// ── i18n mock (echoes ns:key, interpolates single-brace params) ───────────────
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
vi.mock('@/lib/api/connector-resources', () => ({
  getConnectorResources: vi.fn(),
}))
vi.mock('@/lib/api/social-accounts', () => ({
  removeMetaPage: vi.fn(),
  getAvailableMetaPages: vi.fn(),
  activateMetaPage: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import { getConnectorResources } from '@/lib/api/connector-resources'
import type { ConnectorResource } from '@/lib/api/connector-resources'
import { removeMetaPage, getAvailableMetaPages, activateMetaPage } from '@/lib/api/social-accounts'
import type { MetaPage } from '@/lib/api/social-accounts'
import { SocialRoute } from './-social'

const mockGetConnectorResources = vi.mocked(getConnectorResources)
const mockRemoveMetaPage = vi.mocked(removeMetaPage)
const mockGetAvailableMetaPages = vi.mocked(getAvailableMetaPages)
const mockActivateMetaPage = vi.mocked(activateMetaPage)

// ── Fixtures ──────────────────────────────────────────────────────────────────
function makeResource(over: Partial<ConnectorResource> = {}): ConnectorResource {
  return {
    id: 'r1',
    tenant_id: 'acme',
    integration_id: 'i1',
    provider: 'meta',
    resource_type: 'page',
    resource_id: 'pg_1',
    resource_name: 'Acme Page',
    metadata: { ig_username: 'acme_ig' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...over,
  }
}

const AVAILABLE_PAGE: MetaPage = {
  page_id: 'pg_avail',
  page_name: 'Available Page',
  ig_user_id: 'ig123',
  ig_username: 'avail_ig',
  already_connected: false,
}

const CREATED_RESOURCE = makeResource({ id: 'r_new', resource_name: 'Available Page' })

// ── Helpers ───────────────────────────────────────────────────────────────────
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

beforeEach(() => {
  useAuth.getState().clear()
  vi.clearAllMocks()
  setUser()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests — social accounts list ──────────────────────────────────────────────

describe('SocialRoute — connected pages', () => {
  it('renders connected pages after load (name + @ig)', async () => {
    mockGetConnectorResources.mockResolvedValue([makeResource()])

    render(<SocialRoute />)

    expect(await screen.findByText('Acme Page')).toBeInTheDocument()
    expect(screen.getByText('@acme_ig')).toBeInTheDocument()
  })

  it('shows the connected green badge when pages > 0', async () => {
    mockGetConnectorResources.mockResolvedValue([makeResource()])

    render(<SocialRoute />)

    expect(await screen.findByText('settings:social_meta_connected')).toBeInTheDocument()
  })

  it('does not show the connected badge when there are no pages', async () => {
    mockGetConnectorResources.mockResolvedValue([])

    render(<SocialRoute />)

    // Wait for the add button (post-load) then assert no connected badge
    await screen.findByText('settings:social_meta_add')
    expect(screen.queryByText('settings:social_meta_connected')).not.toBeInTheDocument()
  })

  it('calls getConnectorResources with tenant/meta/page on mount', async () => {
    mockGetConnectorResources.mockResolvedValue([])

    render(<SocialRoute />)

    await waitFor(() => {
      expect(mockGetConnectorResources).toHaveBeenCalledWith('acme', 'meta', 'page')
    })
  })

  it('remove button calls removeMetaPage and removes the row', async () => {
    mockGetConnectorResources.mockResolvedValue([makeResource()])
    mockRemoveMetaPage.mockResolvedValue(undefined as unknown as void)

    render(<SocialRoute />)

    await screen.findByText('Acme Page')

    const removeBtn = screen.getByLabelText('settings:social_remove')
    await act(async () => {
      fireEvent.click(removeBtn)
    })

    await waitFor(() => {
      expect(mockRemoveMetaPage).toHaveBeenCalledWith('acme', 'r1')
    })
    await waitFor(() => {
      expect(screen.queryByText('Acme Page')).not.toBeInTheDocument()
    })
  })
})

// ── Tests — meta page picker ──────────────────────────────────────────────────

describe('SocialRoute — meta page picker', () => {
  it('clicking add opens the picker and loads available pages', async () => {
    mockGetConnectorResources.mockResolvedValue([])
    mockGetAvailableMetaPages.mockResolvedValue([AVAILABLE_PAGE])

    render(<SocialRoute />)

    const addBtn = await screen.findByText('settings:social_meta_add')
    await act(async () => {
      fireEvent.click(addBtn)
    })

    await waitFor(() => {
      expect(mockGetAvailableMetaPages).toHaveBeenCalledWith('acme')
    })
    expect(await screen.findByText('Available Page')).toBeInTheDocument()
  })

  it('the picker Add button calls activateMetaPage', async () => {
    mockGetConnectorResources.mockResolvedValue([])
    mockGetAvailableMetaPages.mockResolvedValue([AVAILABLE_PAGE])
    mockActivateMetaPage.mockResolvedValue(CREATED_RESOURCE)

    render(<SocialRoute />)

    const addBtn = await screen.findByText('settings:social_meta_add')
    await act(async () => {
      fireEvent.click(addBtn)
    })

    await screen.findByText('Available Page')

    const pickerAddBtn = screen.getByText('settings:social_picker_add').closest('button')
    await act(async () => {
      fireEvent.click(pickerAddBtn!)
    })

    await waitFor(() => {
      expect(mockActivateMetaPage).toHaveBeenCalledWith('acme', {
        page_id: 'pg_avail',
        page_name: 'Available Page',
        ig_user_id: 'ig123',
        ig_username: 'avail_ig',
      })
    })
  })
})

// ── Tests — monitoring (local stub) ───────────────────────────────────────────

describe('SocialRoute — monitoring', () => {
  it('toggles an AI-report checkbox', async () => {
    mockGetConnectorResources.mockResolvedValue([])

    render(<SocialRoute />)

    await screen.findByText('settings:social_meta_add')

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes.length).toBeGreaterThan(0)
    const daily = checkboxes[0]
    expect(daily.checked).toBe(false)
    await act(async () => {
      fireEvent.click(daily)
    })
    expect(daily.checked).toBe(true)
  })

  it('the save button runs the fake save and shows the saved indicator', async () => {
    mockGetConnectorResources.mockResolvedValue([])

    render(<SocialRoute />)

    const saveBtn = (await screen.findByText('settings:save')).closest('button')
    await act(async () => {
      fireEvent.click(saveBtn!)
    })

    await waitFor(
      () => {
        expect(screen.getByText('settings:saved')).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })
})
