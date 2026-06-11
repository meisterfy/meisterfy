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

// ── TanStack Query mock ───────────────────────────────────────────────────────
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

// ── API mocks ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/api/tenants', () => ({
  getTenant: vi.fn(),
  updateTenant: vi.fn(),
  getGoogleAdsStatus: vi.fn(),
}))
vi.mock('@/lib/api/ai', () => ({
  getAIProviders: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTenant, updateTenant, getGoogleAdsStatus } from '@/lib/api/tenants'
import type { Tenant, AdsMonitoringConfig } from '@/lib/api/tenants'
import { getAIProviders } from '@/lib/api/ai'
import { GoogleAdsRoute } from './google-ads'

const mockUseQuery = vi.mocked(useQuery)
const mockGetTenant = vi.mocked(getTenant)
const mockUpdateTenant = vi.mocked(updateTenant)
const mockGetGoogleAdsStatus = vi.mocked(getGoogleAdsStatus)
const mockGetAIProviders = vi.mocked(getAIProviders)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_ADS_CFG: AdsMonitoringConfig = {
  target_cpa_brl: 50,
  no_conversion_alert_days: 7,
  max_cpa_multiplier: 2,
  min_daily_impressions: 100,
  budget_underpace_threshold: 0.8,
  sync_enabled: true,
  ai_report_daily: false,
  ai_report_weekly: true,
  ai_report_monthly: false,
  adjustments_enabled: true,
  max_increase_pct: 25,
  max_increase_brl: 75,
  max_decrease_pct: 15,
  max_decrease_brl: 30,
  suggestions_enabled: false,
  min_campaign_age_days: 14,
  adjustment_interval_days: 7,
}

function makeTenant(over: Partial<Tenant> = {}): Tenant {
  return {
    id: 'acme',
    name: 'Acme Corp',
    language: 'pt_BR',
    niche: 'SaaS',
    location: 'São Paulo',
    primary_persona: null,
    tone: null,
    instructions: null,
    hashtags: [],
    ads_monitoring: DEFAULT_ADS_CFG,
    report_prompts: {
      instant: 'Custom instant prompt',
      daily: '',
      weekly: 'Custom weekly',
      monthly: undefined,
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...over,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function setupQueryWithTenant(tenant: Tenant | null = null) {
  mockUseQuery.mockReturnValue({
    data: tenant,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useQuery>)
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  useAuth.getState().clear()
  vi.clearAllMocks()
  setUser()
  // Default: not connected, no providers
  mockGetGoogleAdsStatus.mockResolvedValue({ connected: false })
  mockGetAIProviders.mockResolvedValue([])
  mockUpdateTenant.mockResolvedValue(makeTenant())
  setupQueryWithTenant(null)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests — skeleton + no-integration ────────────────────────────────────────

describe('GoogleAdsRoute — status loading', () => {
  it('shows the animate-pulse skeleton while status is loading', () => {
    // Keep promises pending so statusLoading stays true
    mockGetGoogleAdsStatus.mockReturnValue(new Promise(() => {}))
    mockGetAIProviders.mockReturnValue(new Promise(() => {}))

    render(<GoogleAdsRoute />)

    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })

  it('shows the no-integration amber box when gads is not connected', async () => {
    mockGetGoogleAdsStatus.mockResolvedValue({ connected: false })
    mockGetAIProviders.mockResolvedValue([])

    render(<GoogleAdsRoute />)

    await waitFor(() => {
      expect(screen.getByText('settings:gads_no_integration')).toBeInTheDocument()
    })
  })

  it('amber box renders the no-integration description paragraph', async () => {
    mockGetGoogleAdsStatus.mockResolvedValue({ connected: false })
    mockGetAIProviders.mockResolvedValue([])

    render(<GoogleAdsRoute />)

    await waitFor(() => {
      expect(screen.getByText('settings:gads_no_integration')).toBeInTheDocument()
    })

    // The amber box has a second paragraph that renders the description via
    // dangerouslySetInnerHTML. In the test environment the i18n mock returns
    // the key without interpolation — we verify the container is present and
    // contains the description key text (rendered as a <span> child).
    const descSpan = document.querySelector('.rounded-xl.border.border-amber-200 p span')
    expect(descSpan).toBeInTheDocument()
    // The span was rendered via dangerouslySetInnerHTML
    expect(descSpan?.tagName).toBe('SPAN')
  })
})

// ── Tests — connected state ───────────────────────────────────────────────────

describe('GoogleAdsRoute — connected with providers', () => {
  beforeEach(() => {
    mockGetGoogleAdsStatus.mockResolvedValue({ connected: true })
    mockGetAIProviders.mockResolvedValue([{ name: 'openai' }])
    setupQueryWithTenant(makeTenant())
  })

  it('renders the 4 section titles when connected', async () => {
    render(<GoogleAdsRoute />)

    await waitFor(() => {
      expect(screen.getByText('settings:data_sync_title')).toBeInTheDocument()
    })
    expect(screen.getByText('settings:report_prompts_title')).toBeInTheDocument()
    expect(screen.getByText('settings:campaign_adj_title')).toBeInTheDocument()
    expect(screen.getByText('settings:auto_adj_title')).toBeInTheDocument()
  })

  it('seeds the sync_enabled value from tenant ads_monitoring', async () => {
    // DEFAULT_ADS_CFG has sync_enabled: true
    render(<GoogleAdsRoute />)

    await waitFor(() => {
      expect(screen.getByText('settings:data_sync_title')).toBeInTheDocument()
    })

    // The sync switch should reflect the seeded value
    // Since seed happens via useEffect on tenantQuery.data, and we provide it synchronously
    // via the mock, we can check the switch state via aria-checked
    const switches = document.querySelectorAll('[data-slot="switch"]')
    // First switch is sync_enabled (true)
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
  })

  it('seeds adjustments_enabled from tenant ads_monitoring', async () => {
    // DEFAULT_ADS_CFG has adjustments_enabled: true — NumberFields should be visible
    render(<GoogleAdsRoute />)

    await waitFor(() => {
      expect(screen.getByText('settings:data_sync_title')).toBeInTheDocument()
    })

    // adjustments_enabled=true → NumberFields visible
    expect(screen.getByLabelText('settings:field_max_increase_pct')).toBeInTheDocument()
  })
})

// ── Tests — campaign adjustments toggle ──────────────────────────────────────

describe('GoogleAdsRoute — campaign adjustments', () => {
  beforeEach(() => {
    mockGetGoogleAdsStatus.mockResolvedValue({ connected: true })
    mockGetAIProviders.mockResolvedValue([])
    // adjustments_enabled: false
    setupQueryWithTenant(makeTenant({ ads_monitoring: { ...DEFAULT_ADS_CFG, adjustments_enabled: false } }))
  })

  it('shows enable-to-edit text when adjustments are disabled', async () => {
    render(<GoogleAdsRoute />)

    await waitFor(() => {
      expect(screen.getByText('settings:gads_enable_to_edit')).toBeInTheDocument()
    })
  })

  it('shows NumberFields after toggling adjustments on', async () => {
    render(<GoogleAdsRoute />)

    await waitFor(() => {
      expect(screen.getByText('settings:gads_enable_to_edit')).toBeInTheDocument()
    })

    // The adjustments switch is the 2nd switch (index 1 — index 0 is sync)
    const switches = document.querySelectorAll('[data-slot="switch"]')
    // sync switch (0), adjustments switch (1)
    await act(async () => {
      fireEvent.click(switches[1])
    })

    expect(screen.getByLabelText('settings:field_max_increase_pct')).toBeInTheDocument()
  })
})

// ── Tests — save Data Sync ────────────────────────────────────────────────────

describe('GoogleAdsRoute — save ads config', () => {
  beforeEach(() => {
    mockGetGoogleAdsStatus.mockResolvedValue({ connected: true })
    mockGetAIProviders.mockResolvedValue([])
    setupQueryWithTenant(makeTenant())
  })

  it('clicking Save in Data Sync calls updateTenant with ads_monitoring body', async () => {
    mockUpdateTenant.mockResolvedValue(makeTenant())

    render(<GoogleAdsRoute />)

    await waitFor(() => {
      expect(screen.getByText('settings:data_sync_title')).toBeInTheDocument()
    })

    // Find the save button in the Data Sync footer (text = 'settings:save')
    const saveButtons = screen.getAllByText('settings:save')
    await act(async () => {
      fireEvent.click(saveButtons[0])
    })

    await waitFor(() => {
      expect(mockUpdateTenant).toHaveBeenCalledWith(
        'acme',
        expect.objectContaining({
          ads_monitoring: expect.objectContaining({
            sync_enabled: true,
          }),
        }),
      )
    })
  })

  it('save shows saved indicator on success', async () => {
    mockUpdateTenant.mockResolvedValue(makeTenant())

    render(<GoogleAdsRoute />)

    await waitFor(() => {
      expect(screen.getByText('settings:data_sync_title')).toBeInTheDocument()
    })

    const saveButtons = screen.getAllByText('settings:save')
    await act(async () => {
      fireEvent.click(saveButtons[0])
    })

    // Multiple SaveButtons share the savedAds state, so getAllByText is correct here
    await waitFor(() => {
      const savedIndicators = screen.getAllByText('settings:saved')
      expect(savedIndicators.length).toBeGreaterThan(0)
    })
  })
})

// ── Tests — preset buttons ────────────────────────────────────────────────────

describe('GoogleAdsRoute — preset buttons', () => {
  beforeEach(() => {
    mockGetGoogleAdsStatus.mockResolvedValue({ connected: true })
    mockGetAIProviders.mockResolvedValue([])
    setupQueryWithTenant(makeTenant())
  })

  it('clicking a preset button updates minCampaignAgeDays', async () => {
    render(<GoogleAdsRoute />)

    await waitFor(() => {
      expect(screen.getByText('settings:auto_adj_title')).toBeInTheDocument()
    })

    // Find the "7d" preset button for min-campaign-age (default is 14, so 7d is not active)
    const presetBtns = screen.getAllByText('7d')
    await act(async () => {
      fireEvent.click(presetBtns[0])
    })

    // After clicking 7d, the minCampaignAgeDays input should show 7
    const minAgeInput = screen.getByRole('spinbutton', { name: 'settings:auto_adj_min_age_label' })
    expect(minAgeInput).toHaveValue(7)
  })
})

// ── Tests — help modal ────────────────────────────────────────────────────────

describe('GoogleAdsRoute — help modal', () => {
  beforeEach(() => {
    mockGetGoogleAdsStatus.mockResolvedValue({ connected: true })
    mockGetAIProviders.mockResolvedValue([{ name: 'openai' }])
    setupQueryWithTenant(makeTenant())
  })

  it('clicking the help button opens the modal with PROMPT_PARAMS code', async () => {
    render(<GoogleAdsRoute />)

    await waitFor(() => {
      expect(screen.getByText('settings:report_prompts_title')).toBeInTheDocument()
    })

    const helpBtn = screen.getByLabelText('settings:report_prompts_help_aria')
    await act(async () => {
      fireEvent.click(helpBtn)
    })

    await waitFor(() => {
      expect(screen.getByText('settings:params_modal_title')).toBeInTheDocument()
    })

    // At least the first PROMPT_PARAM key should be visible
    expect(screen.getByText('[brand_name]')).toBeInTheDocument()
  })
})
