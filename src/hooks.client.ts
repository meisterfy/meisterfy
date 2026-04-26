import { auth } from '$lib/stores/auth'

export async function init() {
	await auth.restoreSession()
}
