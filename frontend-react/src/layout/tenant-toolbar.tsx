import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Share2, Target, Bell, Menu, X, CircleUser, Settings } from 'lucide-react'
import { BrandIcon } from '@/components/brand-icon'
import { cn } from '@/lib/utils'

interface Client {
  id: string
  name: string
}

interface TenantToolbarProps {
  tenant: string
  brandName: string
  clients: Client[]
}

// inert nav items — target routes land in Phase 3
const NAV_ITEMS = [
  { key: 'social', label: 'Social', icon: Share2, href: (tenant: string) => `/${tenant}/social` },
  {
    key: 'ads',
    label: 'Google Ads',
    icon: Target,
    href: (tenant: string) => `/${tenant}/google-ads`,
  },
  {
    key: 'alerts',
    label: 'Alerts',
    icon: Bell,
    href: (tenant: string) => `/${tenant}/alerts`,
  },
]

export function TenantToolbar({ tenant, brandName, clients }: TenantToolbarProps) {
  const { t } = useTranslation('settings')
  const { t: tGlobals } = useTranslation('globals')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Simple active check — "always false" for inert Phase 3 links is fine; keeping the hook
  // so the markup mirrors Svelte's active-class logic without a real router dep here.
  const isActive = (_key: string) => false

  return (
    <header className='sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90'>
      <div className='mx-auto flex h-14 w-full items-center gap-4 px-4 sm:px-6 lg:px-8'>
        {/* Brand dropdown */}
        <div className='relative flex shrink-0 items-center'>
          <button
            type='button'
            onClick={() => setDropdownOpen((v) => !v)}
            className='flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800'
            aria-haspopup='true'
            aria-expanded={dropdownOpen}
          >
            <BrandIcon name={brandName} />
            <span className='text-base leading-tight font-bold text-slate-900 dark:text-white'>
              {brandName}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-slate-400 transition-transform',
                dropdownOpen && 'rotate-180',
              )}
            />
          </button>

          {dropdownOpen && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                className='fixed inset-0 z-10'
                onClick={() => setDropdownOpen(false)}
                aria-hidden='true'
              />
              <div className='absolute top-full left-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-md dark:border-slate-700 dark:bg-slate-900'>
                <p className='px-2 py-1 text-xs font-medium text-slate-400 uppercase tracking-wide'>
                  Switch Client
                </p>
                {clients.map((c) => (
                  // inert placeholder — target route lands in Phase 3
                  <a
                    key={c.id}
                    href={`/${c.id}/social`}
                    className='flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    onClick={() => setDropdownOpen(false)}
                  >
                    <BrandIcon name={c.name} size='sm' />
                    <span className='truncate'>{c.name}</span>
                  </a>
                ))}
                <div className='my-1 border-t border-slate-200 dark:border-slate-700' />
                {/* inert placeholder — target route lands in Phase 3 */}
                <a
                  href={`/${tenant}/settings`}
                  className='flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  onClick={() => setDropdownOpen(false)}
                >
                  <Settings className='h-4 w-4' />
                  Client Settings
                </a>
                <Link
                  to='/tenants/new'
                  className='flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  onClick={() => setDropdownOpen(false)}
                >
                  {tGlobals('create_client')}
                </Link>
                <a
                  href='/'
                  className='flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  onClick={() => setDropdownOpen(false)}
                >
                  View all clients
                </a>
              </div>
            </>
          )}
        </div>

        {/* Desktop nav — inert placeholders; target routes land in Phase 3 */}
        <nav className='hidden items-center gap-1 md:flex' aria-label='Primary navigation'>
          {NAV_ITEMS.map(({ key, label, icon: Icon, href }) => (
            // inert placeholder — target route lands in Phase 3
            <a
              key={key}
              href={href(tenant)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive(key)
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              <Icon className='h-4 w-4' />
              {label}
            </a>
          ))}
        </nav>

        {/* Spacer */}
        <div className='flex-1' />

        {/* Profile link — minimal inert anchor; full ProfileLink component deferred to Phase 3 */}
        {/* inert placeholder — target route lands in Phase 3 */}
        <a
          href={`/${tenant}/settings/profile`}
          className='hidden items-center rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 md:flex'
          aria-label='Profile'
        >
          <CircleUser className='h-6 w-6' />
        </a>

        {/* Mobile menu toggle */}
        <button
          type='button'
          className='flex items-center rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden'
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
        </button>
      </div>

      {/* Mobile nav panel */}
      {mobileOpen && (
        <div className='border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:hidden'>
          <nav className='flex flex-col gap-1' aria-label='Mobile navigation'>
            {NAV_ITEMS.map(({ key, label, icon: Icon, href }) => (
              // inert placeholder — target route lands in Phase 3
              <a
                key={key}
                href={href(tenant)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(key)
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                )}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className='h-4 w-4' />
                {label}
              </a>
            ))}
            {/*
             * Settings link points toward /$tenant/settings/users (the T22 route).
             * Plain <a> anchor — NOT typed Link — to avoid compile dependency on a
             * route that doesn't exist until T22 lands.
             */}
            <a
              href={`/${tenant}/settings/users`}
              className='flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              onClick={() => setMobileOpen(false)}
            >
              <Settings className='h-4 w-4' />
              {t('title')}
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
