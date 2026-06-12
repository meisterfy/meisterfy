import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface CardBadgeProps {
  variant?: BadgeVariant
  icon?: LucideIcon
  label?: string
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  success:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  warning:
    'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  error: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
}

function CardBadge({ variant = 'default', icon: Icon, label, className }: CardBadgeProps) {
  const classes = cn(
    'inline-flex items-center gap-1 border border-white/5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0',
    label ? 'px-2 py-1' : 'p-2',
    variantClasses[variant] ?? variantClasses.default,
    className,
  )

  return (
    <span className={classes}>
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  )
}

export { CardBadge }
