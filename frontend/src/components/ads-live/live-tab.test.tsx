import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type { LiveCampaignDetail } from '@/lib/api/campaigns'

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="chart" />,
  Bar: () => <div data-testid="chart" />,
  Chart: () => <div data-testid="chart" />,
  Doughnut: () => <div data-testid="chart" />,
}))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) }
})

import { LiveTab } from './live-tab'

const detail = {
  campaign: {
    id: 'c1',
    name: 'My Campaign',
    status: 'ENABLED',
    strategy: 'TARGET_CPA',
    budgetMicros: 50_000_000,
    metrics: {
      impressions: '12345',
      clicks: '500',
      cost: '1200',
      conversions: '40',
      cpa: '30',
      ctr: '4%',
      searchImpressionShare: '0.6',
    },
    history: [],
    adGroups: [],
  },
  wow: {
    cur: { impressions: 12345, clicks: 500, cost: 1200, conversions: 40 },
    prev: { impressions: 10000, clicks: 400, cost: 1000, conversions: 30 },
  },
  budgetPacing: null,
  client: { id: 'cl1' },
  openAlerts: [],
} as unknown as LiveCampaignDetail

const baseProps = {
  isLoadingPeriod: false,
  onSetPeriod: vi.fn(),
  onClearPeriod: vi.fn(),
  devices: [],
  hourly: [],
  impressionShare: null,
}

describe('LiveTab', () => {
  it('shows the 6-card skeleton while detail is null', () => {
    const { container } = render(<LiveTab {...baseProps} detail={null} />)
    expect(container.querySelectorAll('.animate-pulse .h-32').length).toBe(6)
  })

  it('renders metric cards once detail is loaded', () => {
    render(<LiveTab {...baseProps} detail={detail} />)
    expect(screen.getByText('12345')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('calls onSetPeriod / onClearPeriod from the period controls', async () => {
    const user = userEvent.setup()
    const onSetPeriod = vi.fn()
    const onClearPeriod = vi.fn()
    render(<LiveTab {...baseProps} detail={detail} onSetPeriod={onSetPeriod} onClearPeriod={onClearPeriod} />)
    await user.click(screen.getByRole('button', { name: 'analytics.period_7d' }))
    expect(onSetPeriod).toHaveBeenCalledWith(7)
    await user.click(screen.getByRole('button', { name: 'all_time' }))
    expect(onClearPeriod).toHaveBeenCalled()
  })
})
