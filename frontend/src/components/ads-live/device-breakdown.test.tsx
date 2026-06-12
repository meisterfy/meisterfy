import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeviceBreakdown } from './device-breakdown'
import type { DeviceRow } from '@/lib/api/campaigns'

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
  Doughnut: (props: { data: unknown }) => (
    <div data-testid="chart" data-chart={JSON.stringify(props.data)} />
  ),
  Chart: (props: { data: unknown }) => (
    <div data-testid="chart" data-chart={JSON.stringify(props.data)} />
  ),
}))

function dev(device: string, over: Partial<DeviceRow> = {}): DeviceRow {
  return {
    device,
    cost: 100,
    conversions: 10,
    clicks: 50,
    impressions: 500,
    cpa: 10,
    ctr: 0.1,
    ...over,
  }
}

describe('DeviceBreakdown', () => {
  it('shows empty message with no devices', () => {
    render(<DeviceBreakdown devices={[]} />)
    expect(screen.getByText('analytics.device_empty')).toBeInTheDocument()
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument()
  })

  it('builds doughnut from device costs/labels', () => {
    const devices = [
      dev('DESKTOP', { cost: 60, cpa: 6 }),
      dev('MOBILE', { cost: 40, cpa: 4 }),
    ]
    render(<DeviceBreakdown devices={devices} />)
    const data = JSON.parse(screen.getByTestId('chart').getAttribute('data-chart')!)
    expect(data.labels).toEqual(['analytics.device_desktop', 'analytics.device_mobile'])
    expect(data.datasets[0].data).toEqual([60, 40])
    expect(data.datasets[0].backgroundColor).toEqual(['#3b82f6', '#22c55e'])
  })

  it('renders cpa bars sorted ascending, excluding zero-conversion devices', () => {
    const devices = [
      dev('DESKTOP', { conversions: 5, cpa: 12 }),
      dev('MOBILE', { conversions: 5, cpa: 4 }),
      dev('TABLET', { conversions: 0, cpa: 99 }),
    ]
    render(<DeviceBreakdown devices={devices} />)
    // sorted asc by cpa: MOBILE (4) then DESKTOP (12); TABLET excluded
    expect(screen.getByText('R$4.00')).toBeInTheDocument()
    expect(screen.getByText('R$12.00')).toBeInTheDocument()
    expect(screen.queryByText('R$99.00')).not.toBeInTheDocument()
  })
})
