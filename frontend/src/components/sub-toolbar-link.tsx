import { cn } from '@/lib/utils'

/**
 * Active/idle class string for a sub-toolbar nav link. Pair with a typed
 * <Link className={subToolbarLinkClass(active)}> per the social layout.
 */
export function subToolbarLinkClass(active: boolean) {
  return cn(
    'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
    active
      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
  )
}
