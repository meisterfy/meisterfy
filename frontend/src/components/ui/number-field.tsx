import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NumberFieldProps {
  id: string
  label: string
  suffix: string
  value: number
  onValueChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

function NumberField({
  id,
  label,
  suffix,
  value,
  onValueChange,
  min = 0,
  max,
  step = 1,
  className,
}: NumberFieldProps) {
  return (
    <div className={cn(className)}>
      <Label htmlFor={id} className='mb-1 block text-xs font-medium text-slate-500'>
        {label}
      </Label>
      <div className='relative'>
        <Input
          id={id}
          type='number'
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onValueChange(Number(e.target.value))}
          className='pr-8'
        />
        <span className='pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-400'>
          {suffix}
        </span>
      </div>
    </div>
  )
}

export { NumberField }
export type { NumberFieldProps }
