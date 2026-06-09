import { useAuth } from '../../store/auth'

// Mirrors the Svelte withFallback: resolve the promise, but on failure return the fallback so
// the page never crashes. Svelte threw a SvelteKit redirect(302,'/login') on 401; React has no
// plain-util equivalent, so we preserve the intent — a 401 means the session is dead, so we clear
// auth (the route guards then redirect to /login) and still return the fallback.
export function withFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return promise.catch((err: unknown) => {
    if ((err as { status?: number })?.status === 401) {
      useAuth.getState().clear()
    }
    return fallback
  })
}
