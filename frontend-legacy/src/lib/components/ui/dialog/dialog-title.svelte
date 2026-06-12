<script lang="ts">
	import { Dialog } from 'bits-ui'
	import type { DialogTitleProps } from 'bits-ui'

	let { class: className = '', ...restProps }: DialogTitleProps = $props()
</script>

<Dialog.Title
	class="text-base font-bold text-slate-900 dark:text-white {className}"
	{...restProps}
/>
