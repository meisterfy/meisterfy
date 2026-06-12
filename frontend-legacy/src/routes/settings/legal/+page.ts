import { getLegalVersions } from '$lib/api/legal'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ fetch }) => {
	return {
		versions: withFallback(getLegalVersions(fetch), [])
	}
}
