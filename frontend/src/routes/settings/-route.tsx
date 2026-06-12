import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Link2, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SettingsLayout() {
  const { t } = useTranslation('settings')
  const { t: tIntegrations } = useTranslation('integrations')
  const location = useLocation()

  const onBack = () => {
    if (history.length > 1) {
      history.back()
    } else {
      // fallback: navigate to root without router to avoid dependency on useNavigate
      window.location.href = '/'
    }
  }

  const integrationsActive = location.pathname.includes('/integrations')
  const legalActive = location.pathname.includes('/legal')

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top toolbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-14 w-full items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title={t('nav_back_aria')}
            aria-label={t('nav_back_aria')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <span className="text-base font-bold text-slate-900 dark:text-white">
              {t('title')}
            </span>
          </div>
        </div>
      </header>

      {/* Sub-toolbar nav */}
      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-11 items-center gap-1 px-4 sm:px-6 lg:px-8">
          {/* Plain anchor — /settings/integrations has validateSearch params that
              make a typed Link require an explicit search object; plain href is fine. */}
          <a
            href="/settings/integrations"
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              integrationsActive
                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
          >
            <Link2 className="h-4 w-4" />
            {tIntegrations('title')}
          </a>

          <Link
            to="/settings/legal"
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              legalActive
                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
          >
            <ScrollText className="h-4 w-4" />
            {t('nav_legal')}
          </Link>
        </div>
      </div>

      <main className="flex flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
