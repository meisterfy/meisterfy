import { auth } from '$lib/stores/auth.svelte'

export async function init() {
	await auth.restoreSession()
}
