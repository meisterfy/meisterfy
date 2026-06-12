import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
// i18n must be initialised before any component that calls useTranslation
import '@/lib/i18n/index'
import { FloatingChat } from './floating-chat'
import type { CampaignChatStore, ChatMessage } from '@/features/campaigns/use-campaign-chat'

// ---------------------------------------------------------------------------
// Stub chat factory — builds a plain object matching the hook's return shape
// ---------------------------------------------------------------------------

function makeChat(overrides: Partial<CampaignChatStore> = {}): CampaignChatStore {
  return {
    messages: [],
    isOpen: false,
    busy: false,
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
    send: vi.fn(),
    abort: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  }
}

const DEFAULT_PROPS = {
  systemPrompt: 'You are an assistant.',
  tenantId: 'tenant-1',
  campaignId: 'camp-1',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FloatingChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- closed state --------------------------------------------------------

  it('closed state: floating button is shown', () => {
    const chat = makeChat({ isOpen: false, messages: [] })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    expect(screen.getByRole('button', { name: /open ai chat/i })).toBeInTheDocument()
  })

  it('closed state: chat panel is not shown', () => {
    const chat = makeChat({ isOpen: false, messages: [] })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    // The chat title should only appear in the panel header
    expect(screen.queryByText('AI Campaign Chat')).not.toBeInTheDocument()
  })

  it('closed + no messages: no badge is shown', () => {
    const chat = makeChat({ isOpen: false, messages: [] })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    // badge span would contain a number — easiest way: no spans inside the button
    const btn = screen.getByRole('button', { name: /open ai chat/i })
    const badge = btn.querySelector('span')
    expect(badge).toBeNull()
  })

  it('closed + messages: badge shows assistant message count', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'More?' },
      { role: 'assistant', content: 'Sure' },
    ]
    const chat = makeChat({ isOpen: false, messages })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    const btn = screen.getByRole('button', { name: /open ai chat/i })
    const badge = btn.querySelector('span')
    expect(badge?.textContent).toBe('2')
  })

  it('clicking the floating button calls chat.open', async () => {
    const user = userEvent.setup()
    const chat = makeChat({ isOpen: false, messages: [] })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    await user.click(screen.getByRole('button', { name: /open ai chat/i }))

    expect(chat.open).toHaveBeenCalledTimes(1)
  })

  // ---- open + empty --------------------------------------------------------

  it('open + empty messages: shows hint text', () => {
    const chat = makeChat({ isOpen: true, messages: [] })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    expect(screen.getByText('Ask anything about this campaign.')).toBeInTheDocument()
    expect(screen.getByText('Campaign data is pre-loaded as context.')).toBeInTheDocument()
  })

  it('open + empty: floating button is not shown', () => {
    const chat = makeChat({ isOpen: true, messages: [] })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    expect(screen.queryByRole('button', { name: /open ai chat/i })).not.toBeInTheDocument()
  })

  // ---- open + messages -----------------------------------------------------

  it('open + messages: renders assistant content (via md html) and user text', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'What is the CPA?' },
      { role: 'assistant', content: 'The CPA is **$10**.' },
    ]
    const chat = makeChat({ isOpen: true, messages })
    const { container } = render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    // User bubble — plain text
    expect(screen.getByText('What is the CPA?')).toBeInTheDocument()

    // Assistant bubble — dangerouslySetInnerHTML, so check strong element
    const strong = container.querySelector('strong')
    expect(strong?.textContent).toBe('$10')
  })

  it('open + streaming message with content: renders streaming cursor', () => {
    const messages: ChatMessage[] = [
      { role: 'assistant', content: 'Partial answer', streaming: true },
    ]
    const chat = makeChat({ isOpen: true, messages })
    const { container } = render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    // Streaming cursor: animate-pulse span
    const cursor = container.querySelector('.animate-pulse')
    expect(cursor).toBeInTheDocument()
  })

  it('open + streaming message with no content: renders three bounce dots', () => {
    const messages: ChatMessage[] = [
      { role: 'assistant', content: '', streaming: true },
    ]
    const chat = makeChat({ isOpen: true, messages })
    const { container } = render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    const dots = container.querySelectorAll('.animate-bounce')
    expect(dots).toHaveLength(3)
  })

  // ---- input + send --------------------------------------------------------

  it('typing in textarea and pressing Enter calls chat.send with tenant_id, system, and trimmed text', async () => {
    const user = userEvent.setup()
    const chat = makeChat({ isOpen: true, messages: [], busy: false })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    const textarea = screen.getByPlaceholderText(/ask about keywords/i)
    await user.type(textarea, '  What is the budget?  {Enter}')

    expect(chat.send).toHaveBeenCalledWith(
      { tenant_id: 'tenant-1', system: 'You are an assistant.' },
      'What is the budget?'
    )
  })

  it('Shift+Enter does NOT submit', async () => {
    const user = userEvent.setup()
    const chat = makeChat({ isOpen: true, messages: [], busy: false })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    const textarea = screen.getByPlaceholderText(/ask about keywords/i)
    await user.type(textarea, 'Hello{Shift>}{Enter}{/Shift}')

    expect(chat.send).not.toHaveBeenCalled()
  })

  // ---- clear / close buttons -----------------------------------------------

  it('close button calls chat.close', async () => {
    const user = userEvent.setup()
    const chat = makeChat({ isOpen: true, messages: [] })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    // The X button has no accessible label, find by its parent area — use title or container query
    // Close button is the last button in the header's right side
    const buttons = screen.getAllByRole('button')
    // When messages=0, only close button is in the header actions
    const closeBtn = buttons.find((b) => b.querySelector('.lucide-x'))
    expect(closeBtn).toBeDefined()
    await user.click(closeBtn!)

    expect(chat.close).toHaveBeenCalledTimes(1)
  })

  it('clear button is shown when messages exist and calls chat.clear', async () => {
    const user = userEvent.setup()
    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }]
    const chat = makeChat({ isOpen: true, messages })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    const clearBtn = screen.getByTitle('Clear conversation')
    await user.click(clearBtn)

    expect(chat.clear).toHaveBeenCalledTimes(1)
  })

  it('clear button is NOT shown when messages is empty', () => {
    const chat = makeChat({ isOpen: true, messages: [] })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    expect(screen.queryByTitle('Clear conversation')).not.toBeInTheDocument()
  })

  // ---- busy state ----------------------------------------------------------

  it('busy state: abort button is shown instead of send', () => {
    const chat = makeChat({ isOpen: true, messages: [], busy: true })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    // Abort button has title 'Stop generation'
    expect(screen.getByTitle('Stop generation')).toBeInTheDocument()
  })

  it('busy state: clicking abort button calls chat.abort', async () => {
    const user = userEvent.setup()
    const chat = makeChat({ isOpen: true, messages: [], busy: true })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    await user.click(screen.getByTitle('Stop generation'))

    expect(chat.abort).toHaveBeenCalledTimes(1)
  })

  it('busy state: textarea is disabled', () => {
    const chat = makeChat({ isOpen: true, messages: [], busy: true })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    const textarea = screen.getByPlaceholderText(/ask about keywords/i)
    expect(textarea).toBeDisabled()
  })

  it('not busy state: send button is shown', () => {
    const chat = makeChat({ isOpen: true, messages: [], busy: false })
    render(<FloatingChat chat={chat} {...DEFAULT_PROPS} />)

    // Send button has no title, but abort should NOT be there
    expect(screen.queryByTitle('Stop generation')).not.toBeInTheDocument()
    // Textarea is enabled
    const textarea = screen.getByPlaceholderText(/ask about keywords/i)
    expect(textarea).not.toBeDisabled()
  })
})
