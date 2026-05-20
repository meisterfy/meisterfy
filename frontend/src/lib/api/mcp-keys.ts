import { apiFetch, apiFetchData } from './client'

export interface McpApiKey {
  id: string
  name: string
  role: 'readonly' | 'editor' | 'admin'
  key_prefix: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
}

export interface CreateMcpKeyResponse extends McpApiKey {
  key: string
}

export const listMcpKeys = (tenantId: string, fetchFn?: typeof fetch) =>
  apiFetchData<McpApiKey[]>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/mcp-keys`,
    {},
    fetchFn
  )

export const createMcpKey = (
  tenantId: string,
  body: { name: string; role: string; expires_at?: string }
) =>
  apiFetch<CreateMcpKeyResponse>(`/admin/tenants/${encodeURIComponent(tenantId)}/mcp-keys`, {
    method: 'POST',
    body: JSON.stringify(body)
  })

export const revokeMcpKey = (tenantId: string, keyId: string) =>
  apiFetch<void>(`/admin/tenants/${encodeURIComponent(tenantId)}/mcp-keys/${keyId}`, {
    method: 'DELETE'
  })
