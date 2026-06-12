import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Activity } from 'lucide-react'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) }
})

import { MetricCard } from './metric-card'

describe('MetricCard', () => {
  it('renders label, value, subtitle and an up delta', () => {
    render(
      <MetricCard
        icon={Activity}
        label="Impressions"
        value="1,000"
        subtitle="Share: 65%"
        delta={{ pct: '+20%', dir: 'up' }}
      />,
    )
    expect(screen.getByText('Impressions')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.getByText('Share: 65%')).toBeInTheDocument()
    expect(screen.getByText(/\+20%/)).toBeInTheDocument()
  })

  it('hides the delta row when dir is flat', () => {
    render(<MetricCard icon={Activity} label="X" value="1" delta={{ pct: '~0%', dir: 'flat' }} />)
    expect(screen.queryByText(/~0%/)).not.toBeInTheDocument()
  })
})
