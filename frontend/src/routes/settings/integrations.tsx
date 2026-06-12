import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/store/auth'
import { getIntegrations } from '@/lib/api/integrations'
import { getTenants } from '@/lib/api/tenants'
import { qk, fallbackQuery } from '@/lib/query'
import { useIntegrationManager } from '@/features/integrations/use-integration-manager'
import { IntegrationSection } from '@/features/integrations/integration-section'
import { CardConnected } from '@/features/integrations/card-connected'
import { CardAdd } from '@/features/integrations/card-add'
import { IntegrationFilters } from '@/features/integrations/integration-filters'
import { IntegrationModal } from '@/features/integrations/integration-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/settings/integrations')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  validateSearch: (s) => ({
    connected: s.connected as string | undefined,
    provider_name: s.provider_name as string | undefined,
  }),
  component: IntegrationsRoute,
})

function IntegrationsRoute() {
  const { t } = useTranslation('integrations')

  const integrationsQuery = useQuery({
    queryKey: qk.integrations,
    queryFn: () =>
      fallbackQuery(() => getIntegrations(), { integrations: [], providers: [] }),
  })

  const tenantsQuery = useQuery({
    queryKey: qk.tenants,
    queryFn: () => fallbackQuery(() => getTenants(), []),
  })

  const manager = useIntegrationManager()

  useEffect(() => {
    if (integrationsQuery.data && tenantsQuery.data) {
      manager.init({
        data: Promise.resolve(integrationsQuery.data),
        tenants: Promise.resolve(tenantsQuery.data),
      })
    }
    // `manager` is rebuilt every render (no stable identity), so we key the
    // (re-)init solely on the query data — including it would loop every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationsQuery.data, tenantsQuery.data])

  useEffect(() => {
    if (manager.justConnected) {
      toast.success(manager.connectedMessage)
    }
  }, [manager.justConnected, manager.connectedMessage])

  return (
    <>
      <div className='w-full px-4 py-8 sm:px-6 lg:px-8' data-testid='integrations-page'>
        {manager.isLoading ? (
          <div className='space-y-8'>
            {Array.from({ length: 2 }, (_, sectionIdx) => (
              <section key={sectionIdx}>
                <Skeleton className='mb-3 h-4 w-24' />
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
                  {Array.from({ length: 8 }, (_, cardIdx) => (
                    <div
                      key={cardIdx}
                      className='flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'
                    >
                      <div className='flex items-center gap-2.5'>
                        <Skeleton className='h-8 w-8 rounded-lg' />
                        <div className='flex-1 space-y-2'>
                          <Skeleton className='h-4 w-24' />
                          <Skeleton className='h-3 w-16' />
                        </div>
                      </div>
                      <Skeleton className='mt-2 h-4 w-full' />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <>
            {manager.integrations.length > 0 && (
              <IntegrationSection
                title={t('connected_title')}
                description={t('connected_desc')}
              >
                {manager.integrations.map((integration) => {
                  const provider = manager.providerForIntegration(integration)
                  if (!provider) return null
                  return (
                    <CardConnected
                      key={integration.id}
                      integration={integration}
                      provider={provider}
                      tenantOptions={manager.tenantOptions}
                      onEdit={() => manager.openEdit(integration, provider)}
                      onDelete={() => manager.confirmDelete(integration.id)}
                      onConnect={() => manager.handleConnect(integration.id)}
                    />
                  )
                })}
              </IntegrationSection>
            )}

            <section className='mb-8'>
              <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
                <div>
                  <h2 className='text-xl font-bold tracking-tight text-slate-900 dark:text-white'>
                    {t('browse_title')}
                  </h2>
                  <p className='text-sm text-slate-500'>{t('browse_desc')}</p>
                </div>
                <IntegrationFilters
                  searchQuery={manager.searchQuery}
                  onSearchChange={manager.setSearchQuery}
                  selectedCategory={manager.selectedCategory}
                  onCategoryChange={manager.setSelectedCategory}
                  categories={manager.GROUP_ORDER}
                  categoryLabels={manager.GROUP_LABELS}
                  onClear={manager.clearFilters}
                />
              </div>

              {manager.providers.length === 0 ? (
                <div className='rounded-xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-700'>
                  <p className='text-sm text-slate-400'>{t('no_providers')}</p>
                </div>
              ) : manager.filteredProviders.length > 0 ? (
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
                  {manager.filteredProviders.map((provider) => (
                    <CardAdd
                      key={provider.provider}
                      provider={provider}
                      onClick={() => manager.openCreate(provider)}
                    />
                  ))}
                </div>
              ) : (
                <div className='rounded-xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-700'>
                  <p className='text-sm text-slate-400'>{t('no_match')}</p>
                  <button
                    onClick={manager.clearFilters}
                    className='mt-2 text-sm font-medium text-indigo-600 hover:underline'
                  >
                    {t('clear_all_filters')}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <IntegrationModal
        manager={manager}
        onSave={() => manager.handleSave()}
        onTest={manager.handleTest}
      />

      <ConfirmDialog
        open={manager.showDelete}
        onOpenChange={manager.setShowDelete}
        title={t('delete_title')}
        description={t('delete_desc')}
        confirmLabel={t('delete_confirm')}
        isLoading={manager.isDeleting}
        onConfirm={manager.handleDelete}
      />
    </>
  )
}
