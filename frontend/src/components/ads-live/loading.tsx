import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function Loading() {
  const { t } = useTranslation('ads')
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
        <LoaderCircle className="h-5 w-5 animate-spin text-indigo-500" />
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {t('messages.updating_report_data')}
        </span>
      </div>
    </div>
  )
}
