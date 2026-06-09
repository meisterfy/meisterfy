import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { toast } from 'sonner'
import { Toaster } from './sonner'

describe('sonner toaster', () => {
  it('displays a toast message', async () => {
    render(<Toaster />)
    toast.success('hi')
    expect(await screen.findByText('hi')).toBeInTheDocument()
  })
})
