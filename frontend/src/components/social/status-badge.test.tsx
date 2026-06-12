import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBadge } from './status-badge'

describe('StatusBadge', () => {
  it('renders the status text', () => {
    const { container } = render(<StatusBadge status="scheduled" />)
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('scheduled')
  })

  it('applies scheduled color classes for scheduled status', () => {
    const { container } = render(<StatusBadge status="scheduled" />)
    const className = container.querySelector('span')?.className ?? ''
    expect(className).toContain('bg-indigo-100')
    expect(className).toContain('text-indigo-700')
  })

  it('falls back to draft classes for unknown status', () => {
    const { container } = render(<StatusBadge status="unknown_status" />)
    const className = container.querySelector('span')?.className ?? ''
    expect(className).toContain('bg-slate-100')
    expect(className).toContain('text-slate-600')
  })

  it('renders the status text for unknown status', () => {
    const { container } = render(<StatusBadge status="unknown_status" />)
    expect(container.querySelector('span')?.textContent).toBe('unknown_status')
  })
})
