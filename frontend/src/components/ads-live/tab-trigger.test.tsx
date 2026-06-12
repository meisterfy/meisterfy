import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { TabTrigger } from './tab-trigger'

function harness(defaultValue = 'a') {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue}>
      <TabsPrimitive.List>
        <TabTrigger value="a">Tab A</TabTrigger>
        <TabTrigger value="b">Tab B</TabTrigger>
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  )
}

describe('TabTrigger', () => {
  it('renders its children as a tab', () => {
    render(harness())
    expect(screen.getByRole('tab', { name: 'Tab A' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tab B' })).toBeInTheDocument()
  })

  it('marks the active trigger via aria-selected and data-active styling', () => {
    render(harness('a'))
    const tabA = screen.getByRole('tab', { name: 'Tab A' })
    const tabB = screen.getByRole('tab', { name: 'Tab B' })
    expect(tabA).toHaveAttribute('aria-selected', 'true')
    expect(tabB).toHaveAttribute('aria-selected', 'false')
    expect(tabA.className).toContain('data-active:bg-white/5')
  })

  it('activates a tab on click', async () => {
    const user = userEvent.setup()
    render(harness('a'))
    const tabB = screen.getByRole('tab', { name: 'Tab B' })
    await user.click(tabB)
    expect(tabB).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Tab A' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })
})
