import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'primary' | 'danger' | 'ghost' | 'badge'

interface CardFooterBtnProps {
  href?: string
  onClick?: () => void
  variant?: Variant
  icon?: LucideIcon
  label?: string
  title?: string
  className?: string
}

const variantClasses: Record<Variant, string> = {
  default:
    'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800',
  primary:
    'text-slate-50 bg-slate-500/10 border border-slate-500/20 hover:bg-slate-500/20',
  danger:
    'border border-red-400/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10',
  ghost: 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
  badge: 'h-5 px-2 rounded-full text-[10px] font-bold uppercase tracking-wide',
}

function CardFooterBtn({
  href,
  onClick,
  variant = 'default',
  icon: Icon,
  label,
  title,
  className,
}: CardFooterBtnProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 transition-colors text-xs font-medium rounded-md h-8'
  const padding = label ? 'px-3' : 'px-2'
  const classes = cn(base, padding, variantClasses[variant] ?? variantClasses.default, className)

  if (href) {
    return (
      <a href={href} title={title} className={classes}>
        {Icon && <Icon className={variant === 'badge' ? 'h-3 w-3' : 'h-4 w-4'} />}
        {label && <span>{label}</span>}
      </a>
    )
  }

  if (variant === 'badge') {
    return (
      <span className={classes}>
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
    )
  }

  return (
    <button type="button" onClick={onClick} title={title} className={classes}>
      {Icon && <Icon className="h-4 w-4" />}
      {label && <span>{label}</span>}
    </button>
  )
}

export { CardFooterBtn }
