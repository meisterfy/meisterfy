import { auth } from '$lib/stores/auth.svelte'
import * as Sentry from '@sentry/svelte'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

if (SENTRY_DSN) {
	Sentry.init({
		dsn: SENTRY_DSN,
		environment: import.meta.env.VITE_APP_ENV ?? 'development',
		release: 'mkt-maestro@1.0.0',
		integrations: [Sentry.browserTracingIntegration()],
		tracesSampleRate: 0.2
	})
}

export async function init() {
	try {
		await auth.restoreSession()
	} catch {
		// Network error during session restore — app boots unauthenticated
	}
}
