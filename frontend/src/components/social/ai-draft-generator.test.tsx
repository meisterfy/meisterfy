import '@/lib/i18n/index'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AiDraftGenerator } from './ai-draft-generator'
import type { Post } from '@/lib/api/posts'

vi.mock('@/lib/api/ai', () => ({ streamGenerate: vi.fn(), getAIProviders: vi.fn() }))
vi.mock('@/lib/api/posts', () => ({ createPost: vi.fn() }))

import { streamGenerate, getAIProviders } from '@/lib/api/ai'
import { createPost } from '@/lib/api/posts'

const makePost = (id: string, title: string): Post => ({
  id,
  tenant_id: 'acme',
  status: 'draft',
  title,
  content: 'c',
  hashtags: [],
  media_type: null,
  media_path: null,
  platforms: ['instagram_feed'],
  connector_resource_id: null,
  workflow: null,
  scheduled_date: null,
  scheduled_time: null,
  published_at: null,
  created_at: '2026-06-11T00:00:00Z',
  updated_at: '2026-06-11T00:00:00Z',
})

describe('AiDraftGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createPost).mockImplementation(async (_tenant, body) =>
      makePost('p-' + (body.title ?? ''), body.title ?? ''),
    )
  })

  it('shows the no-provider warning and disables generate when none are connected', async () => {
    vi.mocked(getAIProviders).mockResolvedValue([])
    render(<AiDraftGenerator open onOpenChange={vi.fn()} tenant="acme" onCreated={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByText(/No AI provider connected/)).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /Generate/ })).toBeDisabled()
  })

  it('shows the single connected provider and gates generate on a topic', async () => {
    const user = userEvent.setup()
    vi.mocked(getAIProviders).mockResolvedValue([{ name: 'claude' }])
    render(<AiDraftGenerator open onOpenChange={vi.fn()} tenant="acme" onCreated={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Claude (Anthropic)')).toBeInTheDocument())
    const generate = screen.getByRole('button', { name: /Generate/ })
    expect(generate).toBeDisabled()
    await user.type(screen.getByLabelText(/Topic/), 'Summer sale')
    expect(generate).toBeEnabled()
  })

  it('generates drafts: streams JSON, createPost per draft, onCreated + close', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const onOpenChange = vi.fn()
    vi.mocked(getAIProviders).mockResolvedValue([{ name: 'claude' }])
    vi.mocked(streamGenerate).mockImplementation(async (_req, onChunk) => {
      onChunk({
        content: '[{"title":"A","content":"aa"},{"title":"B","content":"bb"}]',
        done: false,
      })
      onChunk({ content: '', done: true })
    })

    render(
      <AiDraftGenerator open onOpenChange={onOpenChange} tenant="acme" onCreated={onCreated} />,
    )
    await waitFor(() => expect(screen.getByText('Claude (Anthropic)')).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Topic/), 'Summer sale')
    await user.click(screen.getByRole('button', { name: /Generate/ }))

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(2))
    expect(createPost).toHaveBeenCalledWith(
      'acme',
      expect.objectContaining({ title: 'A', content: 'aa', status: 'draft' }),
    )
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    expect(onCreated.mock.calls[0][0]).toHaveLength(2)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('surfaces an error when the stream has no JSON array', async () => {
    const user = userEvent.setup()
    vi.mocked(getAIProviders).mockResolvedValue([{ name: 'claude' }])
    vi.mocked(streamGenerate).mockImplementation(async (_req, onChunk) => {
      onChunk({ content: 'sorry, no json here', done: false })
      onChunk({ content: '', done: true })
    })

    render(<AiDraftGenerator open onOpenChange={vi.fn()} tenant="acme" onCreated={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Claude (Anthropic)')).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Topic/), 'Topic')
    await user.click(screen.getByRole('button', { name: /Generate/ }))

    expect(await screen.findByText('No valid JSON array found in response')).toBeInTheDocument()
    expect(createPost).not.toHaveBeenCalled()
  })
})
