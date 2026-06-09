import { apiFetch } from './client'

export const setUserSystemRole = (userId: string, systemRole: 'user' | 'platform_admin') =>
  apiFetch<void>(`/admin/users/${userId}/system-role`, {
    method: 'PUT',
    body: JSON.stringify({ system_role: systemRole })
  })
