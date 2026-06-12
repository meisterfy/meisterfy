import * as React from 'react'
import { cn } from '@/lib/utils'

interface ConnectionCardProps {
  variant?: 'default' | 'border'
  children: React.ReactNode
  footer?: React.ReactNode
}

function ConnectionCard({ variant = 'default', children, footer }: ConnectionCardProps) {
  const classes =
    variant === 'border'
      ? 'border border-slate-500/20 group hover:border-blue-500/50 hover:shadow-blue-500/10 hover:shadow-lg'
      : 'bg-slate-900 border border-white/5 hover:shadow-lg hover:shadow-black/25'

  return (
    <div className={cn('flex h-full flex-col gap-2 rounded-lg transition-all duration-300', classes)}>
      {children}
      {footer && (
        <div className="mt-auto flex flex-row items-center justify-end gap-2 border-t border-slate-500/20 p-4 transition-all duration-500 group-hover:border-blue-500/40">
          {footer}
        </div>
      )}
    </div>
  )
}

export { ConnectionCard }
