<script lang="ts">
	import { Dialog } from 'bits-ui'
	import type { DialogOverlayProps } from 'bits-ui'

	let { class: className = '', ...restProps }: DialogOverlayProps = $props()
</script>

<Dialog.Overlay
	data-dialog-overlay
	class="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] {className}"
	{...restProps}
/>
