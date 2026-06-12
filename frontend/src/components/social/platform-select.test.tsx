import '@/lib/i18n/index'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PlatformSelect } from './platform-select'
import type { PostPlatform } from '@/lib/social'

describe('PlatformSelect', () => {
  it('shows placeholder when value is empty', () => {
    render(<PlatformSelect value={[]} onChange={vi.fn()} />)
    expect(screen.getByText('Select platforms…')).toBeInTheDocument()
  })

  it('renders a chip per selected platform with its label', () => {
    const value: PostPlatform[] = ['instagram_feed', 'linkedin']
    render(<PlatformSelect value={value} onChange={vi.fn()} />)
    expect(screen.getByText('IG Feed')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn')).toBeInTheDocument()
  })

  it('clicking the trigger opens the dropdown with all 5 platform rows', async () => {
    const user = userEvent.setup()
    render(<PlatformSelect value={[]} onChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /select platforms/i }))

    expect(screen.getByText('IG Feed')).toBeInTheDocument()
    expect(screen.getByText('IG Stories')).toBeInTheDocument()
    expect(screen.getByText('IG Reels')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn')).toBeInTheDocument()
    expect(screen.getByText('Facebook')).toBeInTheDocument()
  })

  it('clicking a dropdown row calls onChange with platform added when absent', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PlatformSelect value={[]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /select platforms/i }))
    // Click the "LinkedIn" row button in the dropdown
    const buttons = screen.getAllByRole('button', { name: /linkedin/i })
    await user.click(buttons[0])

    expect(onChange).toHaveBeenCalledWith(['linkedin'])
  })

  it('clicking a dropdown row calls onChange with platform removed when present', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PlatformSelect value={['linkedin']} onChange={onChange} />)

    // Open the trigger via the aria-haspopup div
    const triggerDiv = document.querySelector('[aria-haspopup="listbox"]') as HTMLElement
    await user.click(triggerDiv)

    // The dropdown is now open; find the dropdown container and the LinkedIn row button within it
    const dropdown = document.querySelector('.absolute.top-full') as HTMLElement
    const linkedinDropdownBtn = Array.from(dropdown.querySelectorAll('button[type="button"]')).find(
      (btn) => btn.textContent?.includes('LinkedIn'),
    ) as HTMLElement
    await user.click(linkedinDropdownBtn)

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('clicking a chip X button calls onChange with that platform removed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PlatformSelect value={['instagram_feed', 'linkedin']} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Remove IG Feed' }))

    expect(onChange).toHaveBeenCalledWith(['linkedin'])
  })

  it('selected rows show the Check icon (indigo checkbox styling)', async () => {
    const user = userEvent.setup()
    render(<PlatformSelect value={['linkedin']} onChange={vi.fn()} />)

    const triggerDiv = document.querySelector('[aria-haspopup="listbox"]') as HTMLElement
    await user.click(triggerDiv)

    // The dropdown is open; find the LinkedIn row in the dropdown and check its checkbox div
    const dropdown = document.querySelector('.absolute.top-full') as HTMLElement
    const linkedinDropdownBtn = Array.from(dropdown.querySelectorAll('button[type="button"]')).find(
      (btn) => btn.textContent?.includes('LinkedIn'),
    ) as HTMLElement
    const checkboxDiv = linkedinDropdownBtn.querySelector('div')
    expect(checkboxDiv?.className).toContain('bg-indigo-600')
  })
})
