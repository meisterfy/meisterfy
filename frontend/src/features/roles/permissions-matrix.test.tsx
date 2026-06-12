import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PermissionsMatrix } from './permissions-matrix'
import type { PermGroup, PermissionsMatrixProps } from './permissions-matrix'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUPS: PermGroup[] = [
  {
    key: 'content',
    label: 'Content',
    perms: [
      { name: 'create:post', has: true },
      { name: 'update:post', has: false },
    ],
  },
  {
    key: 'users',
    label: 'Users',
    perms: [
      { name: 'create:user', has: false },
      { name: 'delete:user', has: false },
    ],
  },
]

const defaultProps: PermissionsMatrixProps = {
  groups: GROUPS,
  onTogglePerm: vi.fn(),
  onToggleGroup: vi.fn(),
  editable: true,
  variant: 'detail',
  permLabel: (name) => `label:${name}`,
  gridClassName: 'grid gap-4',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PermissionsMatrix', () => {
  it('renders all group labels', () => {
    render(<PermissionsMatrix {...defaultProps} />)
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
  })

  it('renders perm labels via permLabel', () => {
    render(<PermissionsMatrix {...defaultProps} />)
    expect(screen.getByText('label:create:post')).toBeInTheDocument()
    expect(screen.getByText('label:update:post')).toBeInTheDocument()
    expect(screen.getByText('label:create:user')).toBeInTheDocument()
  })

  it('renders checkboxes with correct checked state', () => {
    render(<PermissionsMatrix {...defaultProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    // create:post has=true, update:post has=false, create:user has=false, delete:user has=false
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
    expect(checkboxes[2]).not.toBeChecked()
  })

  it('calls onTogglePerm with perm name when checkbox is clicked (editable)', async () => {
    const onTogglePerm = vi.fn()
    render(<PermissionsMatrix {...defaultProps} onTogglePerm={onTogglePerm} editable={true} />)

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[1]) // update:post
    expect(onTogglePerm).toHaveBeenCalledWith('update:post')
  })

  it('checkboxes are disabled when editable=false', () => {
    render(<PermissionsMatrix {...defaultProps} editable={false} />)
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach((cb) => expect(cb).toBeDisabled())
  })

  it('All/None button is absent when editable=false', () => {
    render(<PermissionsMatrix {...defaultProps} editable={false} />)
    expect(screen.queryByText('All')).not.toBeInTheDocument()
    expect(screen.queryByText('None')).not.toBeInTheDocument()
  })

  it('All/None button is present when editable=true', () => {
    render(<PermissionsMatrix {...defaultProps} editable={true} />)
    // content group: create:post has=true but update:post has=false → shows 'All'
    // users group: all has=false → shows 'All'
    expect(screen.getAllByText('All').length).toBeGreaterThan(0)
  })

  it('calls onToggleGroup with group key when All/None is clicked', async () => {
    const onToggleGroup = vi.fn()
    render(<PermissionsMatrix {...defaultProps} onToggleGroup={onToggleGroup} editable={true} />)

    const allButtons = screen.getAllByText('All')
    await userEvent.click(allButtons[0])
    expect(onToggleGroup).toHaveBeenCalledWith('content')
  })

  it('shows None when all perms in a group are checked', () => {
    const allChecked: PermGroup[] = [
      {
        key: 'content',
        label: 'Content',
        perms: [
          { name: 'create:post', has: true },
          { name: 'update:post', has: true },
        ],
      },
    ]
    render(<PermissionsMatrix {...defaultProps} groups={allChecked} editable={true} />)
    expect(screen.getByText('None')).toBeInTheDocument()
    expect(screen.queryByText('All')).not.toBeInTheDocument()
  })

  it('applies detail variant label style', () => {
    render(<PermissionsMatrix {...defaultProps} variant='detail' />)
    const label = screen.getByText('Content')
    expect(label.className).toContain('uppercase')
    expect(label.className).toContain('text-xs')
  })

  it('applies create variant label style', () => {
    render(<PermissionsMatrix {...defaultProps} variant='create' />)
    const label = screen.getByText('Content')
    expect(label.className).toContain('text-sm')
    expect(label.className).toContain('font-semibold')
    expect(label.className).not.toContain('uppercase')
  })

  it('passes gridClassName to the outer div', () => {
    const { container } = render(
      <PermissionsMatrix {...defaultProps} gridClassName='custom-grid-class' />,
    )
    expect(container.firstChild).toHaveClass('custom-grid-class')
  })
})
