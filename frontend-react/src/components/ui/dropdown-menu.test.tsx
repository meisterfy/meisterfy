import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from './dropdown-menu'

function TestMenu({ onItem = vi.fn() }: { onItem?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={onItem}>Profile</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onItem}>
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

describe('dropdown-menu', () => {
  it('renders the trigger button', () => {
    render(<TestMenu />)
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
  })

  it('menu content is not visible before trigger is clicked', () => {
    render(<TestMenu />)
    expect(screen.queryByText('Profile')).not.toBeInTheDocument()
  })

  it('opens and shows items when trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<TestMenu />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('calls onClick when a menu item is clicked', async () => {
    const user = userEvent.setup()
    const onItem = vi.fn()
    render(<TestMenu onItem={onItem} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(await screen.findByText('Profile'))
    expect(onItem).toHaveBeenCalledTimes(1)
  })

  it('applies data-slot to menu content and items', async () => {
    const user = userEvent.setup()
    render(<TestMenu />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByText('Profile')
    expect(document.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="dropdown-menu-item"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="dropdown-menu-separator"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="dropdown-menu-label"]')).not.toBeNull()
  })

  it('marks destructive items with data-variant', async () => {
    const user = userEvent.setup()
    render(<TestMenu />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByText('Logout')
    const logoutItem = document.querySelector(
      '[data-slot="dropdown-menu-item"][data-variant="destructive"]',
    )
    expect(logoutItem).not.toBeNull()
    expect(logoutItem?.textContent).toContain('Logout')
  })
})
