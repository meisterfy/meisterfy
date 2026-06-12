import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
  }
})

import { BudgetPacingCard } from './budget-pacing-card'

describe('BudgetPacingCard', () => {
  it('renders cost, budget and used percentage', () => {
    render(
      <BudgetPacingCard
        pacing={{ date: '2026-06-11', cost: 42.5, budget: 100, pct: 0.42 }}
      />,
    )
    expect(screen.getByText('R$42.50')).toBeInTheDocument()
    expect(screen.getByText('2026-06-11')).toBeInTheDocument()
    expect(
      screen.getByText(/42% analytics.budget_pacing_used/),
    ).toBeInTheDocument()
  })

  it('caps the progress bar width at 100% when overspending', () => {
    const { container } = render(
      <BudgetPacingCard
        pacing={{ date: '2026-06-11', cost: 150, budget: 100, pct: 1.5 }}
      />,
    )
    const bar = container.querySelector('.bg-emerald-500') as HTMLElement
    expect(bar.style.width).toBe('100%')
  })

  it('uses the red color band for low pacing', () => {
    const { container } = render(
      <BudgetPacingCard
        pacing={{ date: '2026-06-11', cost: 10, budget: 100, pct: 0.1 }}
      />,
    )
    expect(container.querySelector('.bg-red-400')).toBeTruthy()
  })
})
