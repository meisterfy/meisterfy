import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
  }
})

import { MonthlyMetricsGrid } from './monthly-metrics-grid'

describe('MonthlyMetricsGrid', () => {
  it('renders all four metric values', () => {
    render(
      <MonthlyMetricsGrid
        metrics={{
          totalCost: 250,
          totalConversions: 12,
          daysActive: 8,
          avgCpa: 20.83,
        }}
      />,
    )
    expect(screen.getByText('R$250.00')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('R$20.83')).toBeInTheDocument()
  })

  it('shows an em dash for cpa when avgCpa is zero', () => {
    render(
      <MonthlyMetricsGrid
        metrics={{
          totalCost: 0,
          totalConversions: 0,
          daysActive: 0,
          avgCpa: 0,
        }}
      />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
