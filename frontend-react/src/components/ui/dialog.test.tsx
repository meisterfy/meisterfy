import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Dialog, DialogContent, DialogTitle } from './dialog'

describe('dialog', () => {
  it('renders content when open', async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          hi
        </DialogContent>
      </Dialog>,
    )
    expect(await screen.findByText('hi')).toBeInTheDocument()
  })
})
