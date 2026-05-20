<script lang="ts">
	import { Dialog } from 'bits-ui'
	import type { DialogDescriptionProps } from 'bits-ui'

	let { class: className = '', ...restProps }: DialogDescriptionProps = $props()
</script>

<Dialog.Description class="text-sm text-slate-500 dark:text-slate-400 {className}" {...restProps} />
