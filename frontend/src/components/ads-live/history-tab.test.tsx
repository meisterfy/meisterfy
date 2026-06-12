import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { DbHistoryDay } from '@/lib/api/campaigns'

vi.mock('react-chartjs-2', () => ({
  Chart: () => <div data-testid="chart" />,
  Bar: () => <div data-testid="chart" />,
}))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) }
})

import { HistoryTab } from './history-tab'

const makeDay = (over: Partial<DbHistoryDay> = {}): DbHistoryDay =>
  ({ date: '2026-06-01', cost: 10, cpa: 5, conversions: 2, impressions: 100, clicks: 5, ...over }) as DbHistoryDay

describe('HistoryTab', () => {
  it('renders an empty wrapper when there is no history', () => {
    const { container } = render(<HistoryTab history={[]} />)
    expect(container.querySelector('[data-testid="chart"]')).not.toBeInTheDocument()
  })

  it('renders the daily cost/CPA chart when history is present', () => {
    render(<HistoryTab history={[makeDay(), makeDay({ date: '2026-06-02' })]} />)
    expect(screen.getByText('graph.daily_cost_cpa')).toBeInTheDocument()
    expect(screen.getAllByTestId('chart').length).toBeGreaterThan(0)
  })
})
