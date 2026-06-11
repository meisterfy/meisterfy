import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HourlyHeatmap } from './hourly-heatmap'
import type { HourlyRow } from '@/lib/api/campaigns'

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

function hr(hour: number, over: Partial<HourlyRow> = {}): HourlyRow {
  return {
    hour,
    cost: 5,
    conversions: 0,
    clicks: 2,
    impressions: 20,
    ...over,
  }
}

describe('HourlyHeatmap', () => {
  it('shows empty message when no conversions', () => {
    const hourly = Array.from({ length: 24 }, (_, h) => hr(h))
    render(<HourlyHeatmap hourly={hourly} />)
    expect(screen.getByText('analytics.hourly_empty')).toBeInTheDocument()
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument()
  })

  it('builds bar+line config highlighting top-3 conversion hours in green', () => {
    const hourly = Array.from({ length: 24 }, (_, h) => hr(h))
    // make hours 10, 14, 18 the top converters
    hourly[10].conversions = 30
    hourly[14].conversions = 20
    hourly[18].conversions = 10
    render(<HourlyHeatmap hourly={hourly} />)
    const data = JSON.parse(screen.getByTestId('chart').getAttribute('data-chart')!)
    expect(data.labels[10]).toBe('10h')
    const colors = data.datasets[0].backgroundColor
    expect(colors[10]).toBe('#10b981')
    expect(colors[14]).toBe('#10b981')
    expect(colors[18]).toBe('#10b981')
    expect(colors[0]).toBe('#6366f1')
    // second dataset is the cost line
    expect(data.datasets[1].data[0]).toBe(5)
  })
})
