import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { ChartConfiguration } from 'chart.js'
import { Activity } from 'lucide-react'

vi.mock('react-chartjs-2', () => ({
  Chart: (props: { data: unknown }) => (
    <div data-testid="chart" data-chart={JSON.stringify(props.data)} />
  ),
}))

import { PerformanceChart } from './performance-chart'

const config = {
  type: 'line',
  data: { labels: ['a'], datasets: [{ label: 'Clicks', data: [1] }] },
  options: {},
} as unknown as ChartConfiguration

describe('PerformanceChart', () => {
  it('renders the title, source and the chart', () => {
    render(<PerformanceChart config={config} title="Timeline" source="Source: API" icon={Activity} />)
    expect(screen.getByText('Timeline')).toBeInTheDocument()
    expect(screen.getByText('Source: API')).toBeInTheDocument()
    expect(screen.getByTestId('chart')).toBeInTheDocument()
  })
})
