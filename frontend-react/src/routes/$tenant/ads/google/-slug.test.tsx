import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type React from 'react'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    createFileRoute: (_path: string) => (opts: { beforeLoad?: () => void; component: unknown }) => ({
      ...opts,
      useParams: () => ({ tenant: 'acme', slug: '2026-01-01_promo' }),
    }),
    redirect: original.redirect,
    useNavigate: () => navigateMock,
    Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
  }
})

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
  }
})

vi.mock('@/lib/api/campaigns', () => ({
  getCampaign: vi.fn(),
  updateCampaign: vi.fn(),
}))

import { getCampaign, updateCampaign } from '@/lib/api/campaigns'
import type { Campaign } from '@/lib/api/campaigns'
import { CampaignDetailRoute } from './$slug'

const makeCampaign = (): Campaign => ({
  id: '2026-01-01_promo',
  tenant_id: 'acme',
  slug: '2026-01-01_promo',
  data: {
    result: {
      id: '2026-01-01_promo',
      status: 'draft',
      platform: 'google_search',
      objective: 'Lead generation',
      budget_suggestion: 'R$ 100/day',
      ad_groups: [
        {
          name: 'Brand terms',
          keywords: ['meisterfy', 'meisterfy app'],
          negative_keywords: ['free'],
          responsive_search_ad: {
            headlines: ['Short headline', 'X'.repeat(35)],
            descriptions: ['A description'],
          },
        },
      ],
    },
    workflow: { reasoning: 'Targets high-intent brand searches.' },
  },
})

describe('CampaignDetailRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(updateCampaign).mockResolvedValue({} as never)
  })

  it('loads the campaign and seeds the editable fields', async () => {
    vi.mocked(getCampaign).mockResolvedValue(makeCampaign())
    render(<CampaignDetailRoute />)

    await waitFor(() => expect(getCampaign).toHaveBeenCalledWith('acme', '2026-01-01_promo'))
    expect(await screen.findByDisplayValue('Lead generation')).toBeInTheDocument()
    expect(screen.getByDisplayValue('R$ 100/day')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Brand terms')).toBeInTheDocument()
    // the over-30-char headline (35 chars) shows the red counter
    expect(screen.getByText('35/30')).toBeInTheDocument()
    expect(screen.getByText('Targets high-intent brand searches.')).toBeInTheDocument()
  })

  it('saves the campaign and navigates back to the list', async () => {
    const user = userEvent.setup()
    vi.mocked(getCampaign).mockResolvedValue(makeCampaign())
    render(<CampaignDetailRoute />)
    await screen.findByDisplayValue('Lead generation')

    await user.click(screen.getByRole('button', { name: 'Save Status' }))

    await waitFor(() => expect(updateCampaign).toHaveBeenCalledTimes(1))
    const [tenantArg, slugArg, body] = vi.mocked(updateCampaign).mock.calls[0]
    expect(tenantArg).toBe('acme')
    expect(slugArg).toBe('2026-01-01_promo')
    expect(body).toMatchObject({ objective: 'Lead generation', status: 'draft' })
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/$tenant/ads/google',
      params: { tenant: 'acme' },
    })
  })

  it('renders a not-found message when the campaign is missing', async () => {
    vi.mocked(getCampaign).mockResolvedValue(null as never)
    render(<CampaignDetailRoute />)
    expect(await screen.findByText('Campaign not found')).toBeInTheDocument()
  })
})
