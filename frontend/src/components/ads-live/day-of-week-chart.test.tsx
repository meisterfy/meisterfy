import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayOfWeekChart } from './day-of-week-chart'
import type { DbHistoryDay } from '@/lib/api/campaigns'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-chartjs-2', () => ({
  Bar: (props: { data: unknown }) => (
    <div data-testid="chart" data-chart={JSON.stringify(props.data)} />
  ),
  Line: (props: { data: unknown }) => (
    <div data-testid="chart" data-chart={JSON.stringify(props.data)} />
  ),
  Chart: (props: { data: unknown }) => (
    <div data-testid="chart" data-chart={JSON.stringify(props.data)} />
  ),
}))

function day(date: string, over: Partial<DbHistoryDay> = {}): DbHistoryDay {
  return {
    date,
    campaign_id: 'c1',
    cost: 10,
    conversions: 2,
    clicks: 5,
    impressions: 100,
    cpa: 5,
    ...over,
  }
}

describe('DayOfWeekChart', () => {
  it('shows min-data message under 14 days', () => {
    const history = Array.from({ length: 13 }, (_, i) => day(`2026-01-${String(i + 1).padStart(2, '0')}`))
    render(<DayOfWeekChart history={history} />)
    expect(screen.getByText('analytics.dow_min_data')).toBeInTheDocument()
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument()
  })

  it('aggregates avg cost per day-of-week and renders both charts', () => {
    // 14 consecutive days starting Thu 2026-01-01.
    // 2026-01-01 is a Thursday (getDay()===4).
    const history = Array.from({ length: 14 }, (_, i) =>
      day(`2026-01-${String(i + 1).padStart(2, '0')}`, { cost: 20, conversions: 4 }),
    )
    render(<DayOfWeekChart history={history} />)
    const charts = screen.getAllByTestId('chart')
    expect(charts).toHaveLength(2)

    const costData = JSON.parse(charts[0].getAttribute('data-chart')!)
    expect(costData.labels).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    // each weekday averages cost 20 (every present day has cost 20)
    expect(costData.datasets[0].data.every((v: number) => v === 20)).toBe(true)

    const cpaData = JSON.parse(charts[1].getAttribute('data-chart')!)
    // cpa = cost/conversions = 20/4 = 5
    expect(cpaData.datasets[0].data.every((v: number) => v === 5)).toBe(true)
  })

  it('excludes days with zero impressions from aggregation', () => {
    const history = [
      ...Array.from({ length: 14 }, (_, i) =>
        day(`2026-01-${String(i + 1).padStart(2, '0')}`, { cost: 10, impressions: 0, conversions: 0 }),
      ),
    ]
    render(<DayOfWeekChart history={history} />)
    const charts = screen.getAllByTestId('chart')
    const costData = JSON.parse(charts[0].getAttribute('data-chart')!)
    // all days have 0 impressions -> every avg is 0
    expect(costData.datasets[0].data.every((v: number) => v === 0)).toBe(true)
    const cpaData = JSON.parse(charts[1].getAttribute('data-chart')!)
    expect(cpaData.datasets[0].data.every((v: number | null) => v === null)).toBe(true)
  })
})
