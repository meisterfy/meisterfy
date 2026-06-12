import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AlertBanner } from './alert-banner'

describe('AlertBanner', () => {
  it('renders each alert message and level', () => {
    render(
      <AlertBanner
        data={{
          openAlerts: [
            {
              id: 'a1',
              level: 'CRITICAL',
              type: 'budget',
              message: 'Over budget',
            },
            { id: 'a2', level: 'WARNING', type: 'cpa', message: 'CPA rising' },
          ],
        }}
      />,
    )
    expect(screen.getByText('Over budget')).toBeInTheDocument()
    expect(screen.getByText('CPA rising')).toBeInTheDocument()
    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    expect(screen.getByText('WARNING')).toBeInTheDocument()
  })

  it('renders the suggested action when present', () => {
    render(
      <AlertBanner
        data={{
          openAlerts: [
            {
              id: 'a1',
              level: 'WARNING',
              type: 'cpa',
              message: 'CPA rising',
              action_suggested: 'Lower bids',
            },
          ],
        }}
      />,
    )
    expect(screen.getByText('Lower bids')).toBeInTheDocument()
  })

  it('renders nothing in the list when there are no alerts', () => {
    const { container } = render(<AlertBanner data={{ openAlerts: [] }} />)
    expect(container.querySelectorAll('.flex.items-start')).toHaveLength(0)
  })
})
