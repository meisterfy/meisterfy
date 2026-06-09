import { withFallback } from './utils/loader'

export const qk = {
  integrations: ['integrations'] as const,
  tenants: ['tenants'] as const,
  tenant: (id: string) => ['tenant', id] as const,
  tenantUsers: (tenant: string, active: boolean) => ['tenant-users', tenant, active] as const,
  roles: ['roles'] as const
}

// Run a queryFn but resolve to `fallback` if it throws — the TanStack Query analogue of withFallback.
// (Same 401 handling lives in withFallback; use whichever fits the call site.)
export async function fallbackQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return withFallback(fn(), fallback)
}
