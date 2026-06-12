import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { ProviderIcon } from '@/components/provider-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { normPlatforms, BRAND_COLOR, type PostShape } from '@/lib/social'

const today = new Date()

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
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface CalendarWidgetProps {
  posts: PostShape[]
  isLoading?: boolean
  onEditPost: (post: PostShape) => void
  onCreatePost: (date: string) => void
}

export function CalendarWidget({
  posts = [],
  isLoading = false,
  onEditPost,
  onCreatePost,
}: CalendarWidgetProps) {
  const { t } = useTranslation('social-media')
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const byDate = new Map<string, PostShape[]>()
    for (const p of posts) {
      if (!p.scheduled_date) continue
      if (!byDate.has(p.scheduled_date)) byDate.set(p.scheduled_date, [])
      byDate.get(p.scheduled_date)!.push(p)
    }
    const cells: Array<{ date: string | null; day: number | null; posts: PostShape[] }> = []
    for (let i = 0; i < firstDay; i++) cells.push({ date: null, day: null, posts: [] })
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(viewMonth + 1).padStart(2, '0')
      const dd = String(d).padStart(2, '0')
      const date = `${viewYear}-${mm}-${dd}`
      cells.push({ date, day: d, posts: byDate.get(date) ?? [] })
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, day: null, posts: [] })
    return cells
  }, [posts, viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }
  function goToToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
  }
  function isToday(date: string | null) {
    return date === today.toISOString().slice(0, 10)
  }

  return (
    <>
      {/* Calendar header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {MONTHS[viewMonth]} {viewYear}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToToday}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-t border-l border-slate-200 dark:border-slate-800">
        {calendarCells.map((cell, i) => (
          <div
            key={cell.date || 'empty-' + i}
            className={`group/cell relative min-h-[110px] border-r border-b border-slate-200 p-1.5 dark:border-slate-800 ${
              cell.date
                ? 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/40'
                : 'bg-slate-50 dark:bg-slate-950'
            }`}
          >
            {cell.day && (
              <>
                <div className="mb-1 flex items-center justify-between px-0.5">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday(cell.date)
                        ? 'bg-indigo-500 text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {cell.day}
                  </span>
                  <button
                    onClick={() => onCreatePost(cell.date!)}
                    aria-label={t('calendar_new_post')}
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 transition-colors group-hover/cell:bg-indigo-50 dark:bg-slate-800 dark:group-hover/cell:bg-indigo-900/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-0.5">
                  {isLoading ? (
                    <div className="space-y-1.5 px-0.5 pt-1">
                      <Skeleton className="h-3 w-full rounded-sm" />
                      <Skeleton className="h-3 w-[85%] rounded-sm" />
                    </div>
                  ) : (
                    <>
                      {cell.posts.slice(0, 3).map((post) => (
                        <button
                          key={post.id}
                          onClick={() => onEditPost(post)}
                          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left opacity-100 transition-opacity hover:opacity-80"
                          style={{
                            background:
                              post.status === 'published'
                                ? 'rgb(220 252 231)'
                                : 'rgb(254 243 199)',
                          }}
                        >
                          {normPlatforms(post.platform)
                            .slice(0, 2)
                            .map((plt) => (
                              <ProviderIcon
                                key={plt}
                                provider={plt}
                                className="h-2.5 w-2.5 shrink-0"
                                style={{ color: BRAND_COLOR[plt] ?? 'currentColor' }}
                              />
                            ))}
                          <span className="truncate text-[10px] font-medium text-slate-700">
                            {post.title}
                          </span>
                        </button>
                      ))}
                      {cell.posts.length > 3 && (
                        <span className="pl-1 text-[10px] text-slate-400">
                          +{cell.posts.length - 3} more
                        </span>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm border border-amber-300 bg-amber-100"></span>{' '}
          Scheduled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm border border-emerald-300 bg-emerald-100"></span>{' '}
          Published
        </span>
        <span className="flex items-center gap-1.5">
          <ProviderIcon provider="instagram" className="h-3 w-3 text-[#E1306C]" />
          Instagram
        </span>
        <span className="flex items-center gap-1.5">
          <ProviderIcon provider="facebook" className="h-3 w-3 text-[#1877F2]" />
          Facebook
        </span>
        <span className="flex items-center gap-1.5">
          <ProviderIcon provider="linkedin" className="h-3 w-3 text-[#0A66C2]" />
          LinkedIn
        </span>
      </div>
    </>
  )
}
