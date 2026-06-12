import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Faithful port of tab-trigger.svelte: a thin styled wrapper over the Tabs
// primitive's Tab. Active state is driven by the primitive's data-active
// attribute (base-ui), matching the Svelte data-[state=active] styling.
export function TabTrigger({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: ReactNode
}) {
  return (
    <TabsPrimitive.Tab
      value={value}
      className={cn(
        'rounded-md border border-white/5 px-4 py-2 text-sm font-bold transition-all duration-200',
        'hover:not-data-active:underline data-active:border-white/10 data-active:bg-white/5',
        className,
      )}
    >
      {children}
    </TabsPrimitive.Tab>
  )
}
