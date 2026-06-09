import type React from 'react'

interface SectionTitleProps {
  title: string
  icon?: React.ReactNode
  children?: React.ReactNode
}

export function SectionTitle({ title, icon, children }: SectionTitleProps) {
  return (
    <div className='border-primary/5 mt-4 flex flex-col items-center justify-between gap-2 border-b pb-4 lg:mt-8 lg:flex-row lg:gap-4'>
      <div className='flex items-end gap-2 lg:gap-4'>
        {icon && (
          <div className='bg-primary/5 flex items-center justify-center rounded-md p-2 dark:bg-white/5'>
            {icon}
          </div>
        )}
        <h2 className='text-text-base text-lg font-semibold lg:-mb-0.5 lg:text-3xl xl:text-4xl'>
          {title}
        </h2>
      </div>
      {children && <div>{children}</div>}
    </div>
  )
}
