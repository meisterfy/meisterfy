import { redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import type { AuthUser } from '@/store/auth'

export function isPlatformAdmin(user: AuthUser | null | undefined): boolean {
  return user?.system_role === 'platform_admin'
}

/** Current user from the Zustand auth store (falls back to the store's in-memory state). */
export function currentUser(): AuthUser | null {
  return useAuth.getState().user
}

/**
 * Platform-wide settings live under `/settings/*` only.
 * Call from route `beforeLoad` in that tree — never from `/`, `/$tenant/*`, etc.
 * NOTE: Svelte's `requirePlatformAdmin` threw a SvelteKit redirect(302).
 * In React/TanStack Router we throw a typed redirect({ to: '/' }) instead.
 */
export function requirePlatformAdmin(): void {
  if (!isPlatformAdmin(currentUser())) {
    throw redirect({ to: '/' })
  }
}
