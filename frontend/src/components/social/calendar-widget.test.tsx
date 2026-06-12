import '@/lib/i18n/index'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CalendarWidget } from './calendar-widget'
import type { PostShape } from '@/lib/social'

// Helper: build a minimal PostShape for the current month
function makePost(overrides: Partial<PostShape> & { id: string; title: string }): PostShape {
  return {
    status: 'scheduled',
    content: '',
    hashtags: [],
    platform: ['instagram_feed'],
    client_id: 'c1',
    media_files: [],
    workflow: null,
    ...overrides,
  }
}

// Build a YYYY-MM-DD string for the current month, given a day number
function currentMonthDate(day: number): string {
  const now = new Date()
  const y = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

describe('CalendarWidget', () => {
  it('renders the current month and year in the header', () => {
    render(<CalendarWidget posts={[]} onEditPost={vi.fn()} onCreatePost={vi.fn()} />)
    const now = new Date()
    expect(screen.getByText(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`)).toBeInTheDocument()
  })

  it('clicking prev changes the header to the previous month', async () => {
    const user = userEvent.setup()
    render(<CalendarWidget posts={[]} onEditPost={vi.fn()} onCreatePost={vi.fn()} />)
    const now = new Date()
    const prevMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

    // "Today" is between prev (<) and next (>) buttons in the header
    const todayBtn = screen.getByText('Today')
    const allBtns = Array.from(document.querySelectorAll('button'))
    const todayIdx = allBtns.indexOf(todayBtn as HTMLButtonElement)
    await user.click(allBtns[todayIdx - 1]) // ChevronLeft is right before Today

    expect(screen.getByText(`${MONTHS[prevMonthIdx]} ${prevYear}`)).toBeInTheDocument()
  })

  it('clicking next changes the header to the next month', async () => {
    const user = userEvent.setup()
    render(<CalendarWidget posts={[]} onEditPost={vi.fn()} onCreatePost={vi.fn()} />)
    const now = new Date()
    const nextMonthIdx = now.getMonth() === 11 ? 0 : now.getMonth() + 1
    const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()

    // Get all buttons in the header navigation area — ChevronLeft, Today, ChevronRight
    const buttons = screen.getAllByRole('button')
    const nextBtn = buttons.find((b) => b.querySelector('svg'))
    // Click the ChevronRight — it's the last icon button before "Today"
    // Use "Today" text button as reference: prev < Today < next in DOM
    const todayBtn = screen.getByText('Today')
    const allBtns = Array.from(document.querySelectorAll('button'))
    const todayIdx = allBtns.indexOf(todayBtn as HTMLButtonElement)
    await user.click(allBtns[todayIdx + 1])

    expect(screen.getByText(`${MONTHS[nextMonthIdx]} ${nextYear}`)).toBeInTheDocument()
  })

  it('"Today" button resets the month after navigating away', async () => {
    const user = userEvent.setup()
    render(<CalendarWidget posts={[]} onEditPost={vi.fn()} onCreatePost={vi.fn()} />)
    const now = new Date()

    // Navigate forward twice
    const allBtns = () => Array.from(document.querySelectorAll('button'))
    const getTodayIdx = () => allBtns().indexOf(screen.getByText('Today') as HTMLButtonElement)
    await user.click(allBtns()[getTodayIdx() + 1])
    await user.click(allBtns()[getTodayIdx() + 1])

    // Navigate back to today
    await user.click(screen.getByText('Today'))

    expect(
      screen.getByText(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`),
    ).toBeInTheDocument()
  })

  it('a post with scheduled_date in the current month renders its title', () => {
    const post = makePost({ id: 'p1', title: 'My Test Post', scheduled_date: currentMonthDate(15) })
    render(<CalendarWidget posts={[post]} onEditPost={vi.fn()} onCreatePost={vi.fn()} />)
    expect(screen.getByText('My Test Post')).toBeInTheDocument()
  })

  it('clicking a post chip calls onEditPost with that post', async () => {
    const user = userEvent.setup()
    const onEditPost = vi.fn()
    const post = makePost({ id: 'p2', title: 'Click Me Post', scheduled_date: currentMonthDate(15) })
    render(<CalendarWidget posts={[post]} onEditPost={onEditPost} onCreatePost={vi.fn()} />)

    await user.click(screen.getByText('Click Me Post'))
    expect(onEditPost).toHaveBeenCalledWith(post)
  })

  it('clicking a day Plus button calls onCreatePost with the YYYY-MM-DD string', async () => {
    const user = userEvent.setup()
    const onCreatePost = vi.fn()
    render(<CalendarWidget posts={[]} onEditPost={vi.fn()} onCreatePost={onCreatePost} />)

    // Find a "New post" aria-label button and click it
    const plusBtns = screen.getAllByRole('button', { name: 'New post' })
    expect(plusBtns.length).toBeGreaterThan(0)
    await user.click(plusBtns[0])

    expect(onCreatePost).toHaveBeenCalledTimes(1)
    // The argument should be a YYYY-MM-DD string
    const dateArg = onCreatePost.mock.calls[0][0] as string
    expect(dateArg).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('isLoading shows skeletons instead of post chips', () => {
    const post = makePost({ id: 'p3', title: 'Loading Post', scheduled_date: currentMonthDate(15) })
    render(
      <CalendarWidget posts={[post]} isLoading={true} onEditPost={vi.fn()} onCreatePost={vi.fn()} />,
    )
    // The title should NOT be present
    expect(screen.queryByText('Loading Post')).not.toBeInTheDocument()
    // Skeletons should be present (data-slot="skeleton")
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('a day with more than 3 posts shows "+N more"', () => {
    const date = currentMonthDate(10)
    const posts = [
      makePost({ id: 'q1', title: 'Post 1', scheduled_date: date }),
      makePost({ id: 'q2', title: 'Post 2', scheduled_date: date }),
      makePost({ id: 'q3', title: 'Post 3', scheduled_date: date }),
      makePost({ id: 'q4', title: 'Post 4', scheduled_date: date }),
      makePost({ id: 'q5', title: 'Post 5', scheduled_date: date }),
    ]
    render(<CalendarWidget posts={posts} onEditPost={vi.fn()} onCreatePost={vi.fn()} />)
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })
})
