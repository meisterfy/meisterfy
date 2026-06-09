import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('renders a div', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement)
  })

  it('applies base animate-pulse classes', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('animate-pulse')
    expect(el.className).toContain('rounded-md')
  })

  it('merges a passed className', () => {
    const { container } = render(<Skeleton className="w-32 h-4" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('w-32')
    expect(el.className).toContain('h-4')
    expect(el.className).toContain('animate-pulse')
  })

  it('forwards extra props to the div', () => {
    const { container } = render(<Skeleton data-testid="skel" aria-label="loading" />)
    const el = container.firstChild as HTMLElement
    expect(el.getAttribute('data-testid')).toBe('skel')
    expect(el.getAttribute('aria-label')).toBe('loading')
  })
})
