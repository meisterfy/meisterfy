import { CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SaveButtonProps {
  isSaving: boolean
  saved: boolean
  onClick: () => void
  text?: string
  savingText?: string
  savedText?: string
  className?: string
}

function SaveButton({ isSaving, saved, onClick, text, savingText, savedText, className }: SaveButtonProps) {
  const { t } = useTranslation('settings')

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Button type='button' disabled={isSaving} onClick={onClick}>
        {isSaving ? (savingText ?? t('saving')) : (text ?? t('save'))}
      </Button>
      {saved && (
        <span className='flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400'>
          <CircleCheck className='h-4 w-4' />
          {savedText ?? t('saved')}
        </span>
      )}
    </div>
  )
}

export { SaveButton }
