import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useTheme, THEME_OPTIONS, type Theme } from '@/store/theme'
import type { TFn } from '@/features/users/user-helpers'

function ThemeToggle() {
  // Scope to 'settings' namespace; TFn widens key to string so dynamic lookup is safe
  const { t: tRaw } = useTranslation('settings')
  const t: TFn = tRaw as TFn
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label={t('theme_title')}
      className="inline-flex rounded-md border divide-x overflow-hidden"
    >
      {THEME_OPTIONS.map((opt) => {
        const Icon = opt.icon
        const isActive = theme === opt.value
        // Strip the "settings:" namespace prefix to get the bare key for the scoped t
        const bareKey = opt.labelKey.replace(/^settings:/, '')
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value as Theme)}
            aria-pressed={isActive}
            title={t(bareKey)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span>{t(bareKey)}</span>
          </button>
        )
      })}
    </div>
  )
}

export { ThemeToggle }
