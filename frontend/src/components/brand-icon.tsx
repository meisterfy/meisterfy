import { cn } from '@/lib/utils'

interface BrandIconProps {
  name: string
  size?: 'sm' | 'md'
}

export function BrandIcon({ name, size = 'md' }: BrandIconProps) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-indigo-100 font-bold text-indigo-600 shadow-sm dark:bg-indigo-900/50 dark:text-indigo-400',
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-sm',
      )}
    >
      {initials}
    </div>
  )
}
