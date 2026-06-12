import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Drawer } from './drawer'

describe('drawer', () => {
  it('renders title and body when open (default mode)', () => {
    render(
      <Drawer open title="X">
        body
      </Drawer>,
    )
    expect(screen.getByText('X')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('default mode renders the visible header bar', () => {
    render(
      <Drawer open title="My Title">
        content
      </Drawer>,
    )
    const header = document.querySelector('[data-slot="drawer-header"]')
    expect(header).not.toBeNull()
    // Title is visible (not sr-only) in default mode
    const title = document.querySelector('[data-slot="drawer-title"]')
    expect(title).not.toBeNull()
    expect(title?.classList.contains('sr-only')).toBe(false)
    expect(title?.textContent).toBe('My Title')
  })

  it('default mode renders the close button', () => {
    render(
      <Drawer open title="Closeable">
        stuff
      </Drawer>,
    )
    const closeBtn = document.querySelector('[data-slot="drawer-close"]')
    expect(closeBtn).not.toBeNull()
  })

  describe('headerless mode', () => {
    it('does NOT render the default header bar', () => {
      render(
        <Drawer open title="Hidden" headerless>
          <div>custom chrome</div>
        </Drawer>,
      )
      const header = document.querySelector('[data-slot="drawer-header"]')
      expect(header).toBeNull()
    })

    it('does NOT render the default close button', () => {
      render(
        <Drawer open title="Hidden" headerless>
          <div>custom chrome</div>
        </Drawer>,
      )
      const closeBtn = document.querySelector('[data-slot="drawer-close"]')
      expect(closeBtn).toBeNull()
    })

    it('renders children directly so consumer owns chrome', () => {
      render(
        <Drawer open title="Hidden" headerless>
          <div data-testid="custom-header">my header</div>
        </Drawer>,
      )
      expect(screen.getByTestId('custom-header')).toBeInTheDocument()
      expect(screen.getByText('my header')).toBeInTheDocument()
    })

    it('renders an sr-only title for accessibility (accessible name preserved)', () => {
      render(
        <Drawer open title="Accessible Name" headerless>
          content
        </Drawer>,
      )
      const title = document.querySelector('[data-slot="drawer-title"]')
      expect(title).not.toBeNull()
      expect(title?.classList.contains('sr-only')).toBe(true)
      expect(title?.textContent).toBe('Accessible Name')
    })
  })
})
