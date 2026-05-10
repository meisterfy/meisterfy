<script lang="ts">
	import { PUBLIC_APP_NAME } from '$env/static/public'

	let {
		title,
		description = ''
	}: {
		title: string
		description?: string
	} = $props()

	let fullTitle = $derived(title ? `${title} - ${PUBLIC_APP_NAME}` : PUBLIC_APP_NAME)
</script>

<svelte:head>
	<title>{fullTitle}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
</svelte:head>
