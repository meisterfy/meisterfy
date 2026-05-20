import { apiFetch, apiFetchData } from './client'

export interface AdminUser {
	id: string
	name: string
	email: string
	locale: string
	timezone: string
	is_active: boolean
	role?: { id: string; name: string }
	system_role?: 'user' | 'platform_admin'
	created_at: string
	updated_at: string
}

export interface AdminRole {
	id: string
	name: string
	tenant_id?: string | null
	permissions: string[]
}

export interface AdminPermission {
	id: string
	name: string
}

export const listTenantUsers = (tenantId: string, active: boolean, fetchFn?: typeof fetch) =>
	apiFetchData<AdminUser[]>(
		`/admin/users?tenant_id=${encodeURIComponent(tenantId)}&active=${active}`,
		{},
		fetchFn
	)

export const reactivateTenantUser = (userId: string, tenantId: string, roleId: string) =>
	apiFetchData<AdminUser>(
		`/admin/users/${userId}/reactivate?tenant_id=${encodeURIComponent(tenantId)}`,
		{
			method: 'POST',
			body: JSON.stringify({ role_id: roleId })
		}
	)

export const createTenantUser = (
	tenantId: string,
	body: { name: string; email: string; password: string; role_id: string; locale: string }
) =>
	apiFetchData<AdminUser>('/admin/users', {
		method: 'POST',
		body: JSON.stringify({ ...body, tenant_id: tenantId })
	})

export const updateTenantUser = (
	userId: string,
	tenantId: string,
	body: { name?: string; email?: string; locale?: string; timezone?: string }
) =>
	apiFetchData<AdminUser>(`/admin/users/${userId}?tenant_id=${encodeURIComponent(tenantId)}`, {
		method: 'PUT',
		body: JSON.stringify(body)
	})

export const deactivateTenantUser = (userId: string, tenantId: string) =>
	apiFetch<void>(`/admin/users/${userId}?tenant_id=${encodeURIComponent(tenantId)}`, {
		method: 'DELETE'
	})

export const assignUserRole = (userId: string, tenantId: string, roleId: string) =>
	apiFetch<void>(`/admin/users/${userId}/role?tenant_id=${encodeURIComponent(tenantId)}`, {
		method: 'PUT',
		body: JSON.stringify({ role_id: roleId })
	})

export const listRoles = (fetchFn?: typeof fetch) =>
	apiFetchData<AdminRole[]>('/admin/roles', {}, fetchFn)

export const createRole = (body: { name: string; permissions: string[] }) =>
	apiFetchData<AdminRole>('/admin/roles', { method: 'POST', body: JSON.stringify(body) })

export const updateRole = (roleId: string, body: { name: string; permissions: string[] }) =>
	apiFetch<void>(`/admin/roles/${roleId}`, {
		method: 'PUT',
		body: JSON.stringify(body)
	})

export const setRolePermissions = (roleId: string, permissions: string[]) =>
	apiFetch<void>(`/admin/roles/${roleId}/permissions`, {
		method: 'PUT',
		body: JSON.stringify({ permissions })
	})

export const deleteRole = (roleId: string) =>
	apiFetch<void>(`/admin/roles/${roleId}`, { method: 'DELETE' })

export const listPermissions = (fetchFn?: typeof fetch) =>
	apiFetchData<AdminPermission[]>('/admin/permissions', {}, fetchFn)
