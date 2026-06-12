import { createFileRoute, Outlet, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getTenant, getTenants } from '@/lib/api/tenants'
import { qk, fallbackQuery } from '@/lib/query'
import { TenantToolbar } from '@/layout/tenant-toolbar'

export const Route = createFileRoute('/$tenant')({
  component: TenantLayout,
})

function TenantLayout() {
  const { tenant } = useParams({ from: '/$tenant' })

  // Svelte did error(404) on missing tenant; deferred to Phase 3 — lenient fallback so the
  // backend-down proof slice renders without a real API response.
  const tenantQuery = useQuery({
    queryKey: qk.tenant(tenant),
    queryFn: () => fallbackQuery(() => getTenant(tenant), null),
  })

  // Lazy clients list — falls back to [] so the toolbar renders even with no backend.
  const clientsQuery = useQuery({
    queryKey: qk.tenants,
    queryFn: () => fallbackQuery(() => getTenants(), []),
  })

  const brandName = tenantQuery.data?.name ?? tenant

  const clients = (clientsQuery.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
  }))

  return (
    <div className='flex min-h-screen w-full flex-col bg-slate-50 dark:bg-slate-950'>
      <TenantToolbar tenant={tenant} brandName={brandName} clients={clients} />

      <main className='flex min-w-0 flex-1 flex-col print:h-auto print:flex-none print:overflow-visible'>
        <Outlet />
      </main>

      {/* Minimal inline footer — full Footer component deferred to Phase 3 */}
      <footer className='border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 dark:border-slate-800'>
        © Meisterfy
      </footer>
    </div>
  )
}
