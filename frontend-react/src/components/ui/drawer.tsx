import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { XIcon } from 'lucide-react'

interface DrawerProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  children: React.ReactNode
}

function Drawer({ open, onOpenChange, title, children }: DrawerProps) {
  return (
    <DialogPrimitive.Root
      data-slot="drawer"
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="drawer-overlay"
          className={cn(
            'fixed inset-0 isolate z-50 bg-black/10 duration-150 supports-backdrop-filter:backdrop-blur-xs',
            'data-open:animate-in data-open:fade-in-0',
            'data-closed:animate-out data-closed:fade-out-0',
          )}
        />
        <DialogPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-hidden bg-popover text-popover-foreground shadow-2xl duration-200 outline-none',
            'data-open:animate-in data-open:slide-in-from-right',
            'data-closed:animate-out data-closed:slide-out-to-right',
            'max-md:inset-x-0 max-md:inset-y-auto max-md:bottom-0 max-md:max-h-[90vh] max-md:max-w-none max-md:rounded-t-2xl',
            'max-md:data-open:slide-in-from-bottom max-md:data-closed:slide-out-to-bottom',
          )}
        >
          <div
            data-slot="drawer-header"
            className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          >
            <DialogPrimitive.Title
              data-slot="drawer-title"
              className="font-heading text-base leading-none font-medium"
            >
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              data-slot="drawer-close"
              render={
                <Button variant="ghost" size="icon-sm" />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <div data-slot="drawer-body" className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { Drawer }
