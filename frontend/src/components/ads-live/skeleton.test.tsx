import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('renders an animated pulse placeholder', () => {
    const { container } = render(<Skeleton />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })
})
