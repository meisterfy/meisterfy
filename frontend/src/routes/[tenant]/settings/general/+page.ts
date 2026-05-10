import type { PageLoad } from './$types'

export const load: PageLoad = async ({ parent }) => {
	const { tenant, client } = await parent()
	return { tenant, brand: client.brand }
}
