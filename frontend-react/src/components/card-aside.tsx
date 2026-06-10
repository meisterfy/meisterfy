import React from 'react'
import { cn } from '@/lib/utils'

interface CardAsideProps {
  title?: string
  description?: string
  aside?: React.ReactNode
  header?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

function CardAside({ title, description, aside, header, footer, children, className }: CardAsideProps) {
  return (
    <div className={cn('flex flex-col gap-6 lg:flex-row lg:gap-8', className)}>
      <div className='flex shrink-0 flex-col lg:w-1/3'>
        {aside ?? (
          <>
            {title && <h2 className='text-text text-base font-semibold'>{title}</h2>}
            {description && <p className='text-text/70 mt-1 text-sm'>{description}</p>}
          </>
        )}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='bg-bg-light text-text border-border flex flex-col overflow-hidden rounded-xl border'>
          {header && <div className='border-border/30 border-b p-4'>{header}</div>}
          <div className='flex-1 p-4'>{children}</div>
          {footer && <div className='mt-auto p-4'>{footer}</div>}
        </div>
      </div>
    </div>
  )
}

export { CardAside }
