import { redirect } from '@sveltejs/kit'

export function withFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
	return promise.catch((err) => {
		if (err?.status === 401 || err?.status === 403) redirect(302, '/login')
		return fallback
	})
}
