import React from 'react'
import { cn } from '@/lib/utils'

function Container({ className, children, ...rest }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-full px-2 lg:w-[1200px] lg:px-4 xl:w-[1600px]', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export { Container }
