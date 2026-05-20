<script lang="ts">
	import { Dialog } from 'bits-ui'
	import type { DialogContentProps } from 'bits-ui'
	import type { Snippet } from 'svelte'
	import Overlay from './dialog-overlay.svelte'

	let {
		class: className = '',
		children,
		...restProps
	}: DialogContentProps & { children?: Snippet } = $props()
</script>

<Dialog.Portal>
	<Overlay />
	<Dialog.Content
		data-dialog-content
		class="fixed top-1/2 left-1/2 z-50 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 {className}"
		{...restProps}
	>
		{@render children?.()}
	</Dialog.Content>
</Dialog.Portal>
