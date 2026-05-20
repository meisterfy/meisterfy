import { apiFetch, apiFetchData } from './client'
import type { ConnectorResource } from './connector-resources'

export type { ConnectorResource }

export type ConnectedMetaPage = {
  id: string
  resource_name: string | null
  metadata: {
    ig_user_id?: string
    ig_username?: string
  }
}

export type MetaPage = {
  page_id: string
  page_name: string
  ig_user_id: string | null
  ig_username: string | null
  already_connected: boolean
}

export const getAvailableMetaPages = (tenant: string, fetchFn?: typeof fetch) =>
  apiFetchData<MetaPage[]>(
    `/admin/tenants/${tenant}/meta/available-pages`,
    {},
    fetchFn
  )

export const activateMetaPage = (
  tenant: string,
  page: Omit<MetaPage, 'already_connected'>
) =>
  apiFetch<ConnectorResource>(`/admin/tenants/${tenant}/meta/pages`, {
    method: 'POST',
    body: JSON.stringify({
      page_id: page.page_id,
      page_name: page.page_name,
      ig_user_id: page.ig_user_id ?? '',
      ig_username: page.ig_username ?? ''
    })
  })

export const removeMetaPage = (tenant: string, resourceId: string) =>
  apiFetch<void>(`/admin/tenants/${tenant}/meta/pages/${resourceId}`, {
    method: 'DELETE'
  })

export const getConnectedMetaPages = (tenant: string, fetchFn?: typeof fetch) =>
  apiFetchData<ConnectedMetaPage[]>(`/admin/tenants/${tenant}/meta/accounts`, {}, fetchFn)
