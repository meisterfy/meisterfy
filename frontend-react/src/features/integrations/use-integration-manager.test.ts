import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
// Ensure i18n is initialised before the hook runs
import '@/lib/i18n/index'
import { useIntegrationManager } from './use-integration-manager'
import type { Integration, ProviderSchema } from '@/lib/api/integrations'
import type { Tenant } from '@/lib/api/tenants'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/integrations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/integrations')>()
  return {
    ...actual,
    createIntegration: vi.fn(),
    updateIntegration: vi.fn(),
    deleteIntegration: vi.fn(),
    testIntegration: vi.fn(),
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useSearch: () => ({}),
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeProvider = (overrides: Partial<ProviderSchema> = {}): ProviderSchema => ({
  provider: 'test_provider',
  group: 'ads',
  display_name: 'Test Provider',
  description: 'A test provider',
  logo_svg: '',
  logo_png: '',
  config_fields: [
    {
      key: 'api_key',
      label: 'API Key',
      type: 'text',
      required: true,
    },
    {
      key: 'region',
      label: 'Region',
      type: 'select',
      required: false,
      options: [
        { value: 'us-east', label: 'US East' },
        { value: 'eu-west', label: 'EU West' },
      ],
    },
  ],
  credential_fields: [
    {
      key: 'secret',
      label: 'Secret',
      type: 'password',
      required: true,
    },
  ],
  oauth_flow: false,
  ...overrides,
})

const makeIntegration = (overrides: Partial<Integration> = {}): Integration => ({
  id: 'integ-1',
  name: 'My Integration',
  provider: 'test_provider',
  group: 'ads',
  status: 'connected',
  error_message: null,
  tenant_ids: ['tenant-a', 'tenant-b'],
  config: {
    api_key: 'key-123',
    region: 'us-east',
    secret: 'secret-abc',
  },
  has_credentials: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

// Helper: build init data arg from plain objects
const makeInitData = (
  integrationsList: Integration[] = [],
  providersList: ProviderSchema[] = [],
  tenantsList: Tenant[] = [],
) => ({
  data: Promise.resolve({
    integrations: integrationsList,
    providers: providersList,
  }),
  tenants: Promise.resolve(tenantsList),
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useIntegrationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- initial state -------------------------------------------------------

  it('starts with empty state and isLoading true', () => {
    const { result } = renderHook(() => useIntegrationManager())
    expect(result.current.integrations).toEqual([])
    expect(result.current.providers).toEqual([])
    expect(result.current.isLoading).toBe(true)
    expect(result.current.searchQuery).toBe('')
    expect(result.current.selectedCategory).toBe('all')
    expect(result.current.showModal).toBe(false)
    expect(result.current.editingId).toBeNull()
  })

  // ---- GROUP_ORDER / GROUP_LABELS -----------------------------------------

  it('exposes GROUP_ORDER with all six categories', () => {
    const { result } = renderHook(() => useIntegrationManager())
    expect(result.current.GROUP_ORDER).toEqual([
      'ads',
      'social_media',
      'media',
      'llm',
      'email',
      'monitoring',
    ])
  })

  it('exposes GROUP_LABELS resolved from i18n', () => {
    const { result } = renderHook(() => useIntegrationManager())
    expect(result.current.GROUP_LABELS.ads).toBe('Advertising')
    expect(result.current.GROUP_LABELS.social_media).toBe('Social Media')
  })

  // ---- clearFilters --------------------------------------------------------

  it('clearFilters resets searchQuery and selectedCategory', () => {
    const { result } = renderHook(() => useIntegrationManager())

    act(() => {
      result.current.setSearchQuery('foo')
      result.current.setSelectedCategory('ads')
    })
    expect(result.current.searchQuery).toBe('foo')
    expect(result.current.selectedCategory).toBe('ads')

    act(() => {
      result.current.clearFilters()
    })
    expect(result.current.searchQuery).toBe('')
    expect(result.current.selectedCategory).toBe('all')
  })

  // ---- filteredProviders ---------------------------------------------------

  it('filteredProviders filters by searchQuery on display_name', async () => {
    const providers = [
      makeProvider({ provider: 'a', display_name: 'Alpha Tool', group: 'ads' }),
      makeProvider({ provider: 'b', display_name: 'Beta Tool', group: 'social_media' }),
    ]
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.init(makeInitData([], providers))
    })

    act(() => {
      result.current.setSearchQuery('alpha')
    })
    expect(result.current.filteredProviders).toHaveLength(1)
    expect(result.current.filteredProviders[0].display_name).toBe('Alpha Tool')
  })

  it('filteredProviders filters by searchQuery on provider key', async () => {
    const providers = [
      makeProvider({ provider: 'google_ads', display_name: 'Google Ads', group: 'ads' }),
      makeProvider({ provider: 'meta', display_name: 'Meta', group: 'social_media' }),
    ]
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.init(makeInitData([], providers))
    })

    act(() => {
      result.current.setSearchQuery('google')
    })
    expect(result.current.filteredProviders).toHaveLength(1)
    expect(result.current.filteredProviders[0].provider).toBe('google_ads')
  })

  it('filteredProviders filters by selectedCategory', async () => {
    const providers = [
      makeProvider({ provider: 'a', display_name: 'A', group: 'ads' }),
      makeProvider({ provider: 'b', display_name: 'B', group: 'social_media' }),
      makeProvider({ provider: 'c', display_name: 'C', group: 'ads' }),
    ]
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.init(makeInitData([], providers))
    })

    act(() => {
      result.current.setSelectedCategory('ads')
    })
    expect(result.current.filteredProviders).toHaveLength(2)
    expect(result.current.filteredProviders.every((p) => p.group === 'ads')).toBe(true)
  })

  it('filteredProviders returns all when selectedCategory is all', async () => {
    const providers = [
      makeProvider({ provider: 'a', group: 'ads' }),
      makeProvider({ provider: 'b', group: 'social_media' }),
    ]
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.init(makeInitData([], providers))
    })

    expect(result.current.filteredProviders).toHaveLength(2)
  })

  // ---- init ---------------------------------------------------------------

  it('init sets integrations, providers, tenantOptions and clears isLoading', async () => {
    const ig = makeIntegration()
    const prov = makeProvider()
    const tenant: Tenant = {
      id: 't-1',
      name: 'Acme',
      language: 'en',
      niche: null,
      location: null,
      primary_persona: null,
      tone: null,
      instructions: null,
      hashtags: [],
      ads_monitoring: null,
      report_prompts: null,
      created_at: '',
      updated_at: '',
    }
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.init(makeInitData([ig], [prov], [tenant]))
    })

    expect(result.current.integrations).toEqual([ig])
    expect(result.current.providers).toEqual([prov])
    expect(result.current.tenantOptions).toEqual([{ value: 't-1', label: 'Acme' }])
    expect(result.current.isLoading).toBe(false)
  })

  // ---- openCreate ---------------------------------------------------------

  it('openCreate sets defaults for select fields, clears editingId, shows modal', () => {
    const provider = makeProvider()
    const { result } = renderHook(() => useIntegrationManager())

    act(() => {
      result.current.openCreate(provider)
    })

    expect(result.current.showModal).toBe(true)
    expect(result.current.editingId).toBeNull()
    expect(result.current.activeProvider).toBe(provider)
    // region is a select field with first option 'us-east'
    expect(result.current.form['region']).toBe('us-east')
    // api_key is text — no default set
    expect(result.current.form['api_key']).toBeUndefined()
    expect(result.current.formName).toBe('')
    expect(result.current.formTenants).toEqual([])
  })

  it('openCreate resets previously set form state', () => {
    const provider = makeProvider()
    const { result } = renderHook(() => useIntegrationManager())

    act(() => {
      result.current.setFormName('Old name')
      result.current.setFormTenants(['t-1'])
    })
    act(() => {
      result.current.openCreate(provider)
    })

    expect(result.current.formName).toBe('')
    expect(result.current.formTenants).toEqual([])
  })

  // ---- openEdit -----------------------------------------------------------

  it('openEdit populates form, formName, formTenants, editingId, activeProvider, showModal', () => {
    const ig = makeIntegration()
    const provider = makeProvider()
    const { result } = renderHook(() => useIntegrationManager())

    act(() => {
      result.current.openEdit(ig, provider)
    })

    expect(result.current.showModal).toBe(true)
    expect(result.current.editingId).toBe('integ-1')
    expect(result.current.activeProvider).toBe(provider)
    expect(result.current.formName).toBe('My Integration')
    expect(result.current.formTenants).toEqual(['tenant-a', 'tenant-b'])
    // config+credential fields populated from ig.config
    expect(result.current.form['api_key']).toBe('key-123')
    expect(result.current.form['region']).toBe('us-east')
    expect(result.current.form['secret']).toBe('secret-abc')
  })

  it('openEdit uses empty string for missing config keys', () => {
    const ig = makeIntegration({ config: {} })
    const provider = makeProvider()
    const { result } = renderHook(() => useIntegrationManager())

    act(() => {
      result.current.openEdit(ig, provider)
    })

    expect(result.current.form['api_key']).toBe('')
    expect(result.current.form['secret']).toBe('')
  })

  // ---- confirmDelete ------------------------------------------------------

  it('confirmDelete sets deletingId and showDelete', () => {
    const { result } = renderHook(() => useIntegrationManager())

    act(() => {
      result.current.confirmDelete('integ-42')
    })

    expect(result.current.deletingId).toBe('integ-42')
    expect(result.current.showDelete).toBe(true)
  })

  // ---- setFormField -------------------------------------------------------

  it('setFormField updates a single form key immutably', () => {
    const { result } = renderHook(() => useIntegrationManager())

    act(() => {
      result.current.setFormField('api_key', 'abc')
    })
    expect(result.current.form['api_key']).toBe('abc')

    act(() => {
      result.current.setFormField('region', 'eu-west')
    })
    expect(result.current.form['api_key']).toBe('abc') // previous key preserved
    expect(result.current.form['region']).toBe('eu-west')
  })

  // ---- handleSave — create path -------------------------------------------

  it('handleSave calls createIntegration when editingId is null', async () => {
    const { createIntegration: mockCreate } =
      await import('@/lib/api/integrations')
    const newIg = makeIntegration({ id: 'new-id' })
    vi.mocked(mockCreate).mockResolvedValueOnce(newIg)

    const provider = makeProvider({ oauth_flow: false })
    const { result } = renderHook(() => useIntegrationManager())

    act(() => {
      result.current.openCreate(provider)
    })
    act(() => {
      result.current.setFormName('New Integration')
    })

    await act(async () => {
      await result.current.handleSave()
    })

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(result.current.integrations).toContainEqual(newIg)
    expect(result.current.showModal).toBe(false)
  })

  it('handleSave calls updateIntegration when editingId is set', async () => {
    const { updateIntegration: mockUpdate } =
      await import('@/lib/api/integrations')
    const ig = makeIntegration()
    const updated = { ...ig, name: 'Updated' }
    vi.mocked(mockUpdate).mockResolvedValueOnce(updated)

    const provider = makeProvider()
    const { result } = renderHook(() => useIntegrationManager())

    // seed integrations list via init first
    await act(async () => {
      await result.current.init(makeInitData([ig], [provider]))
    })

    act(() => {
      result.current.openEdit(ig, provider)
    })
    act(() => {
      result.current.setFormName('Updated')
    })

    await act(async () => {
      await result.current.handleSave()
    })

    expect(mockUpdate).toHaveBeenCalledWith(ig.id, expect.any(Object))
    expect(result.current.integrations[0].name).toBe('Updated')
    expect(result.current.showModal).toBe(false)
  })

  it('handleSave does nothing (toast.error) when formName is empty', async () => {
    const { createIntegration: mockCreate } =
      await import('@/lib/api/integrations')
    const { toast: mockToast } = await import('sonner')
    const provider = makeProvider()
    const { result } = renderHook(() => useIntegrationManager())

    act(() => {
      result.current.openCreate(provider)
      // formName stays ''
    })

    await act(async () => {
      await result.current.handleSave()
    })

    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockToast.error).toHaveBeenCalled()
  })

  // ---- handleTest ---------------------------------------------------------

  it('handleTest calls testIntegration with editingId and toasts success', async () => {
    const { testIntegration: mockTest } = await import('@/lib/api/integrations')
    const { toast: mockToast } = await import('sonner')
    vi.mocked(mockTest).mockResolvedValueOnce({ ok: true })

    const ig = makeIntegration()
    const provider = makeProvider()
    const { result } = renderHook(() => useIntegrationManager())

    act(() => {
      result.current.openEdit(ig, provider)
    })

    await act(async () => {
      await result.current.handleTest()
    })

    expect(mockTest).toHaveBeenCalledWith(ig.id)
    expect(mockToast.success).toHaveBeenCalledWith('Connection successful.')
  })

  it('handleTest toasts error on failure result', async () => {
    const { testIntegration: mockTest } = await import('@/lib/api/integrations')
    const { toast: mockToast } = await import('sonner')
    vi.mocked(mockTest).mockResolvedValueOnce({ ok: false, error: 'Auth error' })

    const ig = makeIntegration()
    const provider = makeProvider()
    const { result } = renderHook(() => useIntegrationManager())

    act(() => {
      result.current.openEdit(ig, provider)
    })

    await act(async () => {
      await result.current.handleTest()
    })

    expect(mockToast.error).toHaveBeenCalledWith('Auth error')
  })

  it('handleTest does nothing when editingId is null', async () => {
    const { testIntegration: mockTest } = await import('@/lib/api/integrations')
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.handleTest()
    })

    expect(mockTest).not.toHaveBeenCalled()
  })

  // ---- handleConnect -------------------------------------------------------

  it('handleConnect updates integration status to connected on success', async () => {
    const { testIntegration: mockTest } = await import('@/lib/api/integrations')
    vi.mocked(mockTest).mockResolvedValueOnce({ ok: true })

    const ig = makeIntegration({ id: 'ig-1', status: 'error' })
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.init(makeInitData([ig]))
    })

    await act(async () => {
      await result.current.handleConnect('ig-1')
    })

    const found = result.current.integrations.find((i) => i.id === 'ig-1')
    expect(found?.status).toBe('connected')
    expect(found?.error_message).toBeNull()
  })

  it('handleConnect updates status to error on failure', async () => {
    const { testIntegration: mockTest } = await import('@/lib/api/integrations')
    vi.mocked(mockTest).mockResolvedValueOnce({ ok: false, error: 'Timeout' })

    const ig = makeIntegration({ id: 'ig-2', status: 'pending' })
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.init(makeInitData([ig]))
    })

    await act(async () => {
      await result.current.handleConnect('ig-2')
    })

    const found = result.current.integrations.find((i) => i.id === 'ig-2')
    expect(found?.status).toBe('error')
    expect(found?.error_message).toBe('Timeout')
  })

  // ---- handleDelete -------------------------------------------------------

  it('handleDelete calls deleteIntegration and removes item from list', async () => {
    const { deleteIntegration: mockDelete } =
      await import('@/lib/api/integrations')
    vi.mocked(mockDelete).mockResolvedValueOnce(undefined as unknown as void)

    const ig = makeIntegration({ id: 'del-1' })
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.init(makeInitData([ig]))
    })

    act(() => {
      result.current.confirmDelete('del-1')
    })

    await act(async () => {
      await result.current.handleDelete()
    })

    expect(mockDelete).toHaveBeenCalledWith('del-1')
    expect(result.current.integrations).toHaveLength(0)
    expect(result.current.showDelete).toBe(false)
    expect(result.current.deletingId).toBeNull()
  })

  it('handleDelete does nothing when deletingId is null', async () => {
    const { deleteIntegration: mockDelete } =
      await import('@/lib/api/integrations')
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.handleDelete()
    })

    expect(mockDelete).not.toHaveBeenCalled()
  })

  // ---- providerForIntegration ---------------------------------------------

  it('providerForIntegration returns the matching provider', async () => {
    const ig = makeIntegration({ provider: 'test_provider' })
    const provider = makeProvider({ provider: 'test_provider' })
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.init(makeInitData([ig], [provider]))
    })

    expect(result.current.providerForIntegration(ig)).toBe(provider)
  })

  it('providerForIntegration returns undefined for unknown provider', async () => {
    const ig = makeIntegration({ provider: 'unknown' })
    const { result } = renderHook(() => useIntegrationManager())

    await act(async () => {
      await result.current.init(makeInitData([ig]))
    })

    expect(result.current.providerForIntegration(ig)).toBeUndefined()
  })

  // ---- justConnected / connectedMessage ------------------------------------

  it('justConnected is false by default (empty search params)', () => {
    const { result } = renderHook(() => useIntegrationManager())
    expect(result.current.justConnected).toBe(false)
  })

  it('connectedMessage is the generic message when provider_name absent', () => {
    const { result } = renderHook(() => useIntegrationManager())
    expect(result.current.connectedMessage).toBe(
      'Integration connected successfully. It is now active.',
    )
  })
})
