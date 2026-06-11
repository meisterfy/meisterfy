import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'

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

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
  }
})

vi.mock('@/lib/api/campaigns', () => ({
  getCampaigns: vi.fn(),
  getLiveCampaigns: vi.fn(),
  createCampaign: vi.fn(),
}))

import { getCampaigns, getLiveCampaigns, createCampaign } from '@/lib/api/campaigns'
import type { Campaign, LiveCampaign } from '@/lib/api/campaigns'
import { GoogleAdsRoute } from './index'

const localCampaign = (): Campaign => ({
  id: '2026-01-01_promo',
  tenant_id: 'acme',
  slug: '2026-01-01_promo',
  data: { result: { id: '2026-01-01_promo', status: 'draft', objective: 'Lead gen' } },
})

const liveCampaign = (): LiveCampaign => ({
  id: 'live-1',
  name: 'Live Promo',
  status: 'ENABLED',
  impressions: '1200',
  clicks: '34',
  cost: 'R$ 50',
})

describe('GoogleAdsRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createCampaign).mockResolvedValue({} as never)
  })

  it('loads and renders local + live campaigns', async () => {
    vi.mocked(getCampaigns).mockResolvedValue([localCampaign()])
    vi.mocked(getLiveCampaigns).mockResolvedValue([liveCampaign()])
    render(<GoogleAdsRoute />)

    await waitFor(() => expect(getCampaigns).toHaveBeenCalledWith('acme'))
    // live name cell + local id cell
    expect(await screen.findByText('Live Promo')).toBeInTheDocument()
    expect(screen.getByText('2026-01-01_promo')).toBeInTheDocument()
    expect(screen.getByText('Lead gen')).toBeInTheDocument()
  })

  it('rejects empty JSON on import', async () => {
    const user = userEvent.setup()
    vi.mocked(getCampaigns).mockResolvedValue([])
    vi.mocked(getLiveCampaigns).mockResolvedValue([])
    render(<GoogleAdsRoute />)
    await waitFor(() => expect(getCampaigns).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'new_campaign' }))
    await user.click(screen.getByRole('button', { name: 'import_submit' }))

    expect(await screen.findByText('JSON cannot be empty')).toBeInTheDocument()
    expect(createCampaign).not.toHaveBeenCalled()
  })

  it('imports a valid google_search campaign', async () => {
    const user = userEvent.setup()
    vi.mocked(getCampaigns).mockResolvedValue([])
    vi.mocked(getLiveCampaigns).mockResolvedValue([])
    render(<GoogleAdsRoute />)
    await waitFor(() => expect(getCampaigns).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'new_campaign' }))
    const payload = {
      result: { id: '2026-02-02_sale', platform: 'google_search', status: 'draft' },
    }
    fireEvent.change(screen.getByPlaceholderText(/workflow/), {
      target: { value: JSON.stringify(payload) },
    })
    await user.click(screen.getByRole('button', { name: 'import_submit' }))

    await waitFor(() =>
      expect(createCampaign).toHaveBeenCalledWith('acme', {
        slug: '2026-02-02_sale',
        data: payload,
      }),
    )
  })
})
