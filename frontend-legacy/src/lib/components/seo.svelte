<script lang="ts">
	import { env } from '$env/dynamic/public'

	let {
		title,
		description = ''
	}: {
		title: string
		description?: string
	} = $props()

	const appName = env.PUBLIC_APP_NAME ?? 'Meisterfy'
	let fullTitle = $derived(title ? `${title} - ${appName}` : appName)
</script>

<svelte:head>
	<title>{fullTitle}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
</svelte:head>
