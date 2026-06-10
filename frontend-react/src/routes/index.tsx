import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Building2, Plus, ArrowRight, Settings, CircleUser } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { getTenants } from '@/lib/api/tenants'
import { qk, fallbackQuery } from '@/lib/query'
import { ProviderIcon } from '@/components/provider-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { isPlatformAdmin } from '@/lib/utils/platform-access'
import { hasPermission } from '@/lib/utils/permissions'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: HomeRoute,
})

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function HomeRoute() {
  const { t } = useTranslation('globals')
  const { t: tTenants } = useTranslation('tenants')
  const user = useAuth((s) => s.user)

  const showGlobalSettings = isPlatformAdmin(user)
  const canCreateTenant = hasPermission(user?.permissions, 'create:tenant')

  const tenantsQuery = useQuery({
    queryKey: qk.tenants,
    queryFn: () => fallbackQuery(() => getTenants(), []),
  })

  const tenants = (tenantsQuery.data ?? []).map((t) => ({
    ...t,
    connectors: t.connectors ?? [],
  }))

  return (
    <div className='flex h-full flex-col bg-slate-50 dark:bg-slate-950'>
      {/* Toolbar */}
      <header className='sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90'>
        <div className='mx-auto flex h-14 w-full items-center gap-4 px-4 sm:px-6 lg:px-8'>
          {/* Logo + title */}
          <div className='flex shrink-0 items-center gap-3'>
            <div className='h-10 w-10'>
              <img src='/logo.svg' alt='Meisterfy' className='h-full w-full object-contain' />
            </div>
            <h1 className='text-lg font-bold uppercase text-slate-900 dark:text-white'>
              Meisterfy
            </h1>
          </div>

          <div className='flex-1' />

          {/* Actions */}
          <div className='flex items-center gap-2'>
            {canCreateTenant && (
              <Link
                to='/tenants/new'
                className='flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/80'
              >
                <Plus className='h-4 w-4' />
                <span className='hidden sm:inline'>{tTenants('create')}</span>
              </Link>
            )}

            {showGlobalSettings && (
              // Plain anchor — the integrations route has searchParam types that
              // complicate typed Links; a simple href is fine for this top-level nav.
              <a
                href='/settings/integrations'
                className='flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                title={t('global_settings_aria')}
              >
                <Settings className='h-4 w-4' />
              </a>
            )}

            {/* Profile link */}
            <Link
              to='/profile'
              className='flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
              aria-label={t('profile_title')}
            >
              <CircleUser className='h-5 w-5' />
            </Link>
          </div>
        </div>
      </header>

      <main className='flex-1 overflow-y-auto'>
        <div className='mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 xl:max-w-[1600px]'>
          <div className='mb-4 mt-8'>
            <h2 className='text-2xl font-bold tracking-tight text-slate-900 lg:text-4xl dark:text-white'>
              {t('welcome_back')}
              {user?.name ? ` ${user.name}!` : '!'}
            </h2>
            <p className='mt-1 text-slate-500 lg:text-lg dark:text-slate-400'>
              {t('select_client')}
            </p>
          </div>

          {tenantsQuery.isLoading ? (
            <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className='h-40 w-full rounded-2xl' />
              ))}
            </div>
          ) : tenants.length === 0 ? (
            <div
              data-testid='empty-state'
              className='flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-800'
            >
              <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/20'>
                <Building2 className='h-8 w-8 text-primary' />
              </div>
              <h3 className='text-lg font-semibold text-slate-900 dark:text-white'>
                {tTenants('empty')}
              </h3>
              <p className='mt-2 text-sm text-slate-500 dark:text-slate-400'>
                {t('create_first_client_hint')}
              </p>
              {canCreateTenant && (
                <Link
                  to='/tenants/new'
                  className='mt-6 flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/80'
                >
                  <Plus className='h-4 w-4' />
                  {t('create_client')}
                </Link>
              )}
            </div>
          ) : (
            <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {tenants.map((tenant) => (
                // TODO(C3): point to /$tenant/social once that route is generated
                <Link
                  key={tenant.id}
                  to='/$tenant'
                  params={{ tenant: tenant.id }}
                  className='group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary/50'
                >
                  <div className='p-6'>
                    <div className='mb-5 flex items-start justify-between'>
                      {/* Initials avatar */}
                      <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-base font-bold text-primary shadow-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground dark:bg-primary/20 dark:text-primary'>
                        {getInitials(tenant.name)}
                      </div>
                      <div className='rounded-full bg-slate-50 p-2 text-slate-400 transition-colors group-hover:bg-primary/10 group-hover:text-primary dark:bg-slate-800 dark:group-hover:bg-primary/20'>
                        <ArrowRight className='h-4 w-4' />
                      </div>
                    </div>

                    <h3 className='text-lg font-bold text-slate-900 transition-colors group-hover:text-primary dark:text-white dark:group-hover:text-primary'>
                      {tenant.name}
                    </h3>

                    {/* Connectors stack */}
                    <div className='mt-6 flex items-center -space-x-2.5 overflow-hidden'>
                      {tenant.connectors.length > 0 ? (
                        tenant.connectors.map((conn) => (
                          <div
                            key={conn.id}
                            className='flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-white p-1.5 shadow-sm dark:border-slate-900 dark:bg-slate-800'
                            title={conn.name}
                          >
                            <ProviderIcon
                              provider={conn.id}
                              logoSvg={conn.logo_svg}
                              logoPng={conn.logo_png}
                              className='h-full w-full'
                            />
                          </div>
                        ))
                      ) : (
                        <div className='text-[10px] font-medium uppercase tracking-tight text-slate-400'>
                          {t('no_connectors')}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
