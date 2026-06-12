import '@/lib/i18n/index'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditDraftDrawer } from './edit-draft-drawer'
import type { PostShape } from '@/lib/social'

vi.mock('@/lib/api/posts', () => ({ updatePost: vi.fn(), deletePost: vi.fn() }))
vi.mock('@/lib/api/media', () => ({ uploadMedia: vi.fn(), deleteMedia: vi.fn() }))

import { updatePost, deletePost } from '@/lib/api/posts'

const makeDraft = (overrides: Partial<PostShape> = {}): PostShape => ({
  id: 'draft-9',
  status: 'draft',
  title: 'Idea',
  content: 'Rough copy',
  hashtags: ['one', 'two'],
  platform: ['instagram_feed'],
  client_id: 'acme',
  media_files: [],
  workflow: { strategy: { framework: 'AIDA', reasoning: 'Hook then CTA' } },
  ...overrides,
})

describe('EditDraftDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(updatePost).mockResolvedValue({} as never)
    vi.mocked(deletePost).mockResolvedValue(undefined as never)
  })

  it('renders nothing when draft is null', () => {
    render(
      <EditDraftDrawer
        open
        onOpenChange={vi.fn()}
        draft={null}
        tenant="acme"
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
  })

  it('populates the form and shows the workflow framework + reasoning', () => {
    render(
      <EditDraftDrawer
        open
        onOpenChange={vi.fn()}
        draft={makeDraft()}
        tenant="acme"
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Title')).toHaveValue('Idea')
    expect(screen.getByLabelText('Content')).toHaveValue('Rough copy')
    expect(screen.getByLabelText(/Hashtags/)).toHaveValue('one two')
    expect(screen.getByText('AIDA')).toBeInTheDocument()
    expect(screen.getByText('Hook then CTA')).toBeInTheDocument()
  })

  it('saves edits → updatePost + onSaved + onOpenChange(false)', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <EditDraftDrawer
        open
        onOpenChange={onOpenChange}
        draft={makeDraft()}
        tenant="acme"
        onSaved={onSaved}
        onDeleted={vi.fn()}
      />,
    )
    const content = screen.getByLabelText('Content')
    await user.clear(content)
    await user.type(content, 'Polished copy')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1))
    expect(updatePost).toHaveBeenCalledWith(
      'acme',
      'draft-9',
      expect.objectContaining({ content: 'Polished copy', hashtags: ['one', 'two'] }),
    )
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved.mock.calls[0][0]).toMatchObject({ id: 'draft-9', content: 'Polished copy' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('deletes the draft via the confirm dialog', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    render(
      <EditDraftDrawer
        open
        onOpenChange={vi.fn()}
        draft={makeDraft()}
        tenant="acme"
        onSaved={vi.fn()}
        onDeleted={onDeleted}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Delete/ }))
    expect(await screen.findByText('Delete draft?')).toBeInTheDocument()
    const confirmButtons = screen.getAllByRole('button', { name: /^Delete$/ })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('acme', 'draft-9'))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('draft-9'))
  })
})
