/** Permission names match backend RBAC seeds (JWT active-tenant claims). */
export function hasPermission(
	permissions: string[] | undefined,
	name: string
): boolean {
	return permissions?.includes(name) ?? false
}
