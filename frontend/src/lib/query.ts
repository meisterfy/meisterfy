import { withFallback } from './utils/loader'

export const qk = {
  integrations: ['integrations'] as const,
  tenants: ['tenants'] as const,
  tenant: (id: string) => ['tenant', id] as const,
  tenantUsers: (tenant: string, active: boolean) => ['tenant-users', tenant, active] as const,
  roles: ['roles'] as const,
  campaigns: (tenant: string) => ['campaigns', tenant] as const,
  campaign: (tenant: string, slug: string) => ['campaign', tenant, slug] as const,
  liveCampaigns: (tenant: string) => ['live-campaigns', tenant] as const,
  posts: (tenant: string, status?: string) => ['posts', tenant, status ?? null] as const,
  post: (tenant: string, id: string) => ['post', tenant, id] as const,
  auditLog: (tenant: string) => ['audit-log', tenant] as const,
  mcpKeys: (tenant: string) => ['mcp-keys', tenant] as const,
  pendingAdjustments: (tenant: string, status?: string) =>
    ['pending-adjustments', tenant, status ?? null] as const,
  socialAccounts: (tenant: string) => ['social-accounts', tenant] as const,
  connectorResources: (tenant: string, provider: string, resourceType: string) =>
    ['connector-resources', tenant, provider, resourceType] as const,
  legalVersions: ['legal-versions'] as const,
  legalVersion: (id: string) => ['legal-version', id] as const,
  aiReports: (tenant: string, campaignId: string, type: string) =>
    ['ai-reports', tenant, campaignId, type] as const
}

// Run a queryFn but resolve to `fallback` if it throws — the TanStack Query analogue of withFallback.
// (Same 401 handling lives in withFallback; use whichever fits the call site.)
export async function fallbackQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return withFallback(fn(), fallback)
}
