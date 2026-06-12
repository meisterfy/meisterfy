import type { ReactNode } from 'react'

export function SubToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  )
}
