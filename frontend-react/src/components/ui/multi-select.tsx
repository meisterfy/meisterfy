'use client'

import * as React from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { cn } from '@/lib/utils'
import { ChevronsUpDown, Check } from 'lucide-react'

export interface MultiSelectOption {
  value: string
  label: string
}

export interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  className?: string
}

function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyLabel = 'No options',
  className,
}: MultiSelectProps) {
  const [search, setSearch] = React.useState('')

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  )

  const selectedLabels = (value ?? []).map(
    (v) => options.find((o) => o.value === v)?.label ?? v,
  )

  function toggle(val: string) {
    const current = value ?? []
    const next = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val]
    onChange(next)
  }

  // Reset search when popover closes
  function handleOpenChange(open: boolean) {
    if (!open) setSearch('')
  }

  const triggerLabel =
    selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder

  return (
    <PopoverPrimitive.Root onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger
        data-slot="multi-select-trigger"
        aria-label={triggerLabel}
        className={cn(
          'flex min-w-[8rem] items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
          className,
        )}
      >
        {selectedLabels.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {selectedLabels.map((label) => (
              <span
                key={label}
                className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
              >
                {label}
              </span>
            ))}
          </span>
        )}
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={4} className="isolate z-50">
          <PopoverPrimitive.Popup
            data-slot="multi-select-content"
            className="w-(--anchor-width) min-w-[10rem] rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            {/* Search input */}
            <div className="border-b p-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Option list */}
            <div className="max-h-48 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="py-3 text-center text-xs text-slate-400">
                  {emptyLabel}
                </p>
              ) : (
                filtered.map((option) => {
                  const isSelected = (value ?? []).includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={option.label}
                      onClick={() => toggle(option.value)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
                    >
                      {/* Inline check box indicator */}
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </span>
                      {option.label}
                    </button>
                  )
                })
              )}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { MultiSelect }
