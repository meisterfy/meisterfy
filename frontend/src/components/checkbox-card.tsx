import { cn } from '@/lib/utils'

interface CheckboxCardProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  title: string
  description: string
  className?: string
}

function CheckboxCard({ checked, onCheckedChange, title, description, className }: CheckboxCardProps) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <input
        type='checkbox'
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className='mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800'
      />
      <div>
        <p className='text-sm font-medium text-slate-700 dark:text-slate-300'>{title}</p>
        <p className='text-xs text-slate-500 dark:text-slate-400'>{description}</p>
      </div>
    </label>
  )
}

export { CheckboxCard }
