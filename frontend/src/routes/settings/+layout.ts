import { requirePlatformAdmin } from '$lib/utils/platform-access'
import type { LayoutLoad } from './$types'

export const load: LayoutLoad = () => {
	requirePlatformAdmin()
	return {}
}
