import { redirect } from '@sveltejs/kit'
import { auth } from '$lib/stores/auth.svelte'
import { getCachedSessionUser } from '$lib/utils/session'
import type { AuthUser } from '$lib/stores/auth.svelte'

export function isPlatformAdmin(user: AuthUser | null | undefined): boolean {
	return user?.system_role === 'platform_admin'
}

/** Current user from memory or session cache (loaders run before reactive auth updates). */
export function currentUser(): AuthUser | null {
	return auth.user ?? getCachedSessionUser()
}

/**
 * Platform-wide settings live under `/settings/*` only.
 * Call from loaders/layouts in that tree — never from `/`, `/[tenant]/*`, etc.
 */
export function requirePlatformAdmin(): void {
	if (!isPlatformAdmin(currentUser())) {
		throw redirect(302, '/')
	}
}
