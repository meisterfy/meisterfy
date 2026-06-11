import { createFileRoute, Link, Outlet, redirect, useLocation, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Settings, BarChart2, Share2, Shield, Users, ShieldCheck, KeyRound } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/$tenant/settings')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: TenantSettingsLayout,
})

export function TenantSettingsLayout() {
  const { tenant } = useParams({ from: '/$tenant/settings' })
  const { t } = useTranslation('settings')
  const location = useLocation()

  const canManageUsers =
    useAuth((s) => s.user?.permissions?.includes('view-any:user')) ?? false

  const navItems = [
    {
      section: 'general',
      label: t('nav_general'),
      icon: Settings,
      typed: true,
    },
    {
      section: 'google-ads',
      label: t('nav_google_ads'),
      icon: BarChart2,
      typed: true,
    },
    {
      section: 'social',
      label: t('nav_social'),
      icon: Share2,
      typed: true,
    },
    {
      section: 'audit',
      label: t('nav_audit'),
      icon: Shield,
      typed: true,
    },
    {
      section: 'users',
      label: t('nav_users'),
      icon: Users,
      typed: true,
      show: canManageUsers,
    },
    {
      section: 'roles',
      label: t('nav_roles'),
      icon: ShieldCheck,
      typed: true,
      show: canManageUsers,
    },
    {
      section: 'mcp',
      label: t('nav_mcp'),
      icon: KeyRound,
      typed: true,
      show: canManageUsers,
    },
  ]

  // Items with no explicit `show` field default to visible
  const visibleItems = navItems.filter((item) => item.show !== false)

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      {/* Sub-toolbar */}
      <div className='border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'>
        <div className='mx-auto flex h-11 items-center gap-1 px-4 sm:px-6 lg:px-8'>
          {visibleItems.map(({ section, label, icon: Icon, typed }) => {
            const isActive = location.pathname.includes(`/settings/${section}`)
            const linkClass = cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            )

            if (typed && section === 'general') {
              return (
                <Link
                  key={section}
                  to='/$tenant/settings/general'
                  params={{ tenant }}
                  className={linkClass}
                >
                  <Icon className='h-4 w-4' />
                  {label}
                </Link>
              )
            }

            if (typed && section === 'users') {
              return (
                <Link
                  key={section}
                  to='/$tenant/settings/users'
                  params={{ tenant }}
                  className={linkClass}
                >
                  <Icon className='h-4 w-4' />
                  {label}
                </Link>
              )
            }

            if (typed && section === 'roles') {
              return (
                <Link
                  key={section}
                  to='/$tenant/settings/roles'
                  params={{ tenant }}
                  className={linkClass}
                >
                  <Icon className='h-4 w-4' />
                  {label}
                </Link>
              )
            }

            if (typed && section === 'audit') {
              return (
                <Link
                  key={section}
                  to='/$tenant/settings/audit'
                  params={{ tenant }}
                  className={linkClass}
                >
                  <Icon className='h-4 w-4' />
                  {label}
                </Link>
              )
            }

            if (typed && section === 'mcp') {
              return (
                <Link
                  key={section}
                  to='/$tenant/settings/mcp'
                  params={{ tenant }}
                  className={linkClass}
                >
                  <Icon className='h-4 w-4' />
                  {label}
                </Link>
              )
            }

            if (typed && section === 'social') {
              return (
                <Link
                  key={section}
                  to='/$tenant/settings/social'
                  params={{ tenant }}
                  className={linkClass}
                >
                  <Icon className='h-4 w-4' />
                  {label}
                </Link>
              )
            }

            if (typed && section === 'google-ads') {
              return (
                <Link
                  key={section}
                  to='/$tenant/settings/google-ads'
                  params={{ tenant }}
                  className={linkClass}
                >
                  <Icon className='h-4 w-4' />
                  {label}
                </Link>
              )
            }

            return (
              // TODO(B8–B13): typed Link once route exists
              <a
                key={section}
                href={`/${tenant}/settings/${section}`}
                className={linkClass}
              >
                <Icon className='h-4 w-4' />
                {label}
              </a>
            )
          })}
        </div>
      </div>

      <main className='flex flex-1 flex-col overflow-y-auto'>
        <Outlet />
      </main>
    </div>
  )
}
