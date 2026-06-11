import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function subToolbarLinkClass(active: boolean) {
  return cn(
    'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
    active
      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
  )
}

interface SubToolbarLinkProps {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
}

/**
 * Plain-anchor sub-toolbar link for routes that are not yet generated (so a
 * typed <Link> would fail tsc). For existing routes, render a typed <Link>
 * with subToolbarLinkClass(active) instead.
 */
export function SubToolbarLink({ href, label, icon: Icon, active }: SubToolbarLinkProps) {
  return (
    <a href={href} className={subToolbarLinkClass(active)}>
      <Icon className="h-4 w-4" />
      {label}
    </a>
  )
}
