import { apiFetch, apiFetchData } from './client'

export type PendingAdjustment = {
  id: string
  tenant_id: string
  campaign_resource_id: string
  adjustment_type: 'bid_increase' | 'bid_decrease' | 'budget_increase' | 'budget_decrease'
  current_value: number
  proposed_value: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'expired'
  created_at: string
  expires_at: string | null
  resolved_at: string | null
  resolved_by: string | null
}

export const listPendingAdjustments = (tenantId: string, status?: string, fetchFn?: typeof fetch) =>
  apiFetchData<PendingAdjustment[]>(
    `/admin/tenants/${tenantId}/pending-adjustments${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    {},
    fetchFn
  )

export const approvePendingAdjustment = (tenantId: string, id: string) =>
  apiFetch<void>(`/admin/tenants/${tenantId}/pending-adjustments/${id}/approve`, { method: 'POST' })

export const rejectPendingAdjustment = (tenantId: string, id: string) =>
  apiFetch<void>(`/admin/tenants/${tenantId}/pending-adjustments/${id}/reject`, { method: 'POST' })
