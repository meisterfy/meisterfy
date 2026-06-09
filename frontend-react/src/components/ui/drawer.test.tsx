import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Drawer } from './drawer'

describe('drawer', () => {
  it('renders title and body when open', () => {
    render(
      <Drawer open title="X">
        body
      </Drawer>,
    )
    expect(screen.getByText('X')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })
})
