import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../../../store/auth'
import { GeneralSettingsRoute } from './general'

// ── Route mock — provide useParams ────────────────────────────────────────────
vi.mock('./general', async (importOriginal) => {
  const original = await importOriginal<typeof import('./general')>()
  // Patch Route.useParams on the exported Route object after the module loads.
  // We cannot reassign the named export; instead we mock at the module factory
  // level and re-export the real component with a patched Route.useParams stub.
  // The component calls Route.useParams() — we mock it on the singleton instance.
  return original
})

// We need Route.useParams to return { tenant: 'acme' }. The easiest way without
// a full router is to mock the tanstack-router module so createFileRoute returns
// a stub whose useParams gives our fixture.
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
    useTranslation: (_ns?: string) => ({
      t: (key: string) => key,
    }),
  }
})

// ── API mocks ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/api/tenants', () => ({
  getTenant: vi.fn(),
  updateTenant: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import { getTenant, updateTenant } from '../../../lib/api/tenants'

const mockGetTenant = vi.mocked(getTenant)
const mockUpdateTenant = vi.mocked(updateTenant)

// ── Fixture tenant ────────────────────────────────────────────────────────────
const FIXTURE_TENANT = {
  id: 'acme',
  name: 'Acme Corp',
  language: 'en_US',
  niche: 'SaaS',
  location: 'São Paulo, Brazil',
  primary_persona: 'First-time homebuyers',
  tone: 'Friendly',
  instructions: 'Always mention our warranty',
  hashtags: ['marketing', 'brand'],
  ads_monitoring: null,
  report_prompts: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderRoute(queryClient = makeQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <GeneralSettingsRoute />
    </QueryClientProvider>,
  )
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
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests — rendering & seed ──────────────────────────────────────────────────

describe('GeneralSettingsRoute — rendering', () => {
  it('renders the form with seeded values from the fetched tenant', async () => {
    setUser()
    mockGetTenant.mockResolvedValue(FIXTURE_TENANT)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('SaaS')).toBeInTheDocument()
    expect(screen.getByDisplayValue('São Paulo, Brazil')).toBeInTheDocument()
    expect(screen.getByDisplayValue('First-time homebuyers')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Friendly')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Always mention our warranty')).toBeInTheDocument()
    // hashtags seeded as space-joined
    expect(screen.getByDisplayValue('marketing brand')).toBeInTheDocument()
  })

  it('renders the save button', async () => {
    setUser()
    mockGetTenant.mockResolvedValue(FIXTURE_TENANT)
    renderRoute()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'save_changes' })).toBeInTheDocument()
    })
  })

  it('shows a skeleton while loading', () => {
    setUser()
    // Never resolve — stays loading
    mockGetTenant.mockReturnValue(new Promise(() => {}))
    renderRoute()
    // Skeletons render immediately while fetching
    const skeletons = document.querySelectorAll('[class*="skeleton"], [class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

// ── Tests — validation ────────────────────────────────────────────────────────

describe('GeneralSettingsRoute — validation', () => {
  it('shows error_required_name and does NOT call updateTenant when name is empty', async () => {
    setUser()
    mockGetTenant.mockResolvedValue({ ...FIXTURE_TENANT, name: '' })

    renderRoute()

    // Wait for the form to appear (loading resolves)
    await waitFor(() => {
      expect(screen.getByTestId('general-settings-form')).toBeInTheDocument()
    })

    // Use fireEvent.submit to bypass HTML5 native required validation in jsdom
    const form = screen.getByTestId('general-settings-form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('error_required_name')
    })

    expect(mockUpdateTenant).not.toHaveBeenCalled()
  })

  it('clears the error when a valid submit follows an invalid one', async () => {
    const user = userEvent.setup()
    setUser()
    mockGetTenant.mockResolvedValue({ ...FIXTURE_TENANT, name: '' })
    mockUpdateTenant.mockResolvedValue(FIXTURE_TENANT)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByTestId('general-settings-form')).toBeInTheDocument()
    })

    const form = screen.getByTestId('general-settings-form')
    // First submit with empty name — use fireEvent to bypass native required
    fireEvent.submit(form)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    // Now fill in a name
    const nameInput = screen.getByLabelText(/field_brand_name/i)
    await user.type(nameInput, 'Valid Name')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})

// ── Tests — save logic ────────────────────────────────────────────────────────

describe('GeneralSettingsRoute — save', () => {
  it('calls updateTenant with the trimmed flat body including parsed hashtags', async () => {
    const user = userEvent.setup()
    setUser()
    mockGetTenant.mockResolvedValue(FIXTURE_TENANT)
    mockUpdateTenant.mockResolvedValue(FIXTURE_TENANT)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'save_changes' }))

    await waitFor(() => {
      expect(mockUpdateTenant).toHaveBeenCalledWith('acme', {
        name: 'Acme Corp',
        niche: 'SaaS',
        language: 'en_US',
        location: 'São Paulo, Brazil',
        primary_persona: 'First-time homebuyers',
        tone: 'Friendly',
        instructions: 'Always mention our warranty',
        hashtags: ['marketing', 'brand'],
      })
    })
  })

  it('parses # prefixes from hashtags_raw before sending', async () => {
    const user = userEvent.setup()
    setUser()
    mockGetTenant.mockResolvedValue({ ...FIXTURE_TENANT, hashtags: [] })
    mockUpdateTenant.mockResolvedValue(FIXTURE_TENANT)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument()
    })

    const hashtagsInput = screen.getByLabelText(/field_hashtags/i)
    await user.clear(hashtagsInput)
    await user.type(hashtagsInput, '#foo bar #baz')

    await user.click(screen.getByRole('button', { name: 'save_changes' }))

    await waitFor(() => {
      expect(mockUpdateTenant).toHaveBeenCalledWith(
        'acme',
        expect.objectContaining({ hashtags: ['foo', 'bar', 'baz'] }),
      )
    })
  })

  it('shows the saved indicator after a successful save', async () => {
    const user = userEvent.setup()
    setUser()
    mockGetTenant.mockResolvedValue(FIXTURE_TENANT)
    mockUpdateTenant.mockResolvedValue(FIXTURE_TENANT)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'save_changes' }))

    await waitFor(() => {
      expect(screen.getByTestId('general-saved')).toBeInTheDocument()
    })
  })

  it('shows the error message when updateTenant rejects', async () => {
    const user = userEvent.setup()
    setUser()
    mockGetTenant.mockResolvedValue(FIXTURE_TENANT)
    mockUpdateTenant.mockRejectedValue(new Error('Server exploded'))

    renderRoute()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'save_changes' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server exploded')
    })
  })

  it('falls back to error_generic when the thrown error has no message', async () => {
    const user = userEvent.setup()
    setUser()
    mockGetTenant.mockResolvedValue(FIXTURE_TENANT)
    mockUpdateTenant.mockRejectedValue({})

    renderRoute()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'save_changes' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('error_generic')
    })
  })

  it('sends null for optional fields left empty', async () => {
    const user = userEvent.setup()
    setUser()
    mockGetTenant.mockResolvedValue({
      ...FIXTURE_TENANT,
      niche: null,
      location: null,
      primary_persona: null,
      tone: null,
      instructions: null,
      hashtags: [],
    })
    mockUpdateTenant.mockResolvedValue(FIXTURE_TENANT)

    renderRoute()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'save_changes' }))

    await waitFor(() => {
      expect(mockUpdateTenant).toHaveBeenCalledWith(
        'acme',
        expect.objectContaining({
          niche: null,
          location: null,
          primary_persona: null,
          tone: null,
          instructions: null,
          hashtags: [],
        }),
      )
    })
  })
})

// ── Tests — seed-once guard ───────────────────────────────────────────────────

describe('GeneralSettingsRoute — seed-once guard', () => {
  it('does not clobber user edits when the query resolves again', async () => {
    const user = userEvent.setup()
    setUser()

    // Start with resolving query
    mockGetTenant.mockResolvedValue(FIXTURE_TENANT)

    const queryClient = makeQueryClient()
    renderRoute(queryClient)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument()
    })

    // User edits the name
    const nameInput = screen.getByDisplayValue('Acme Corp')
    await user.clear(nameInput)
    await user.type(nameInput, 'My Edited Name')

    // Simulate a background refetch by triggering another resolved value
    mockGetTenant.mockResolvedValue({ ...FIXTURE_TENANT, name: 'Server Name' })
    await queryClient.invalidateQueries({ queryKey: ['tenant', 'acme'] })

    // Name stays as the user typed it (not overwritten by refetch)
    await waitFor(() => {
      expect(screen.getByDisplayValue('My Edited Name')).toBeInTheDocument()
    })
  })
})
