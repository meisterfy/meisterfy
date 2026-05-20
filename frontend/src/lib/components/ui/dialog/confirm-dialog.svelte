<script lang="ts">
	import { TriangleAlert } from 'lucide-svelte'
	import * as Dialog from './index'

	let {
		open = $bindable(false),
		title = 'Are you sure?',
		description = 'This action cannot be undone.',
		confirmLabel = 'Delete',
		cancelLabel = 'Cancel',
		isLoading = false,
		onconfirm
	}: {
		open: boolean
		title?: string
		description?: string
		confirmLabel?: string
		cancelLabel?: string
		isLoading?: boolean
		onconfirm: () => void
	} = $props()
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-sm p-0">
		<Dialog.Header>
			<div class="flex items-start gap-3">
				<div
					class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
				>
					<TriangleAlert class="h-5 w-5 text-red-600 dark:text-red-400" />
				</div>
				<div>
					<Dialog.Title>{title}</Dialog.Title>
					<Dialog.Description class="mt-1">{description}</Dialog.Description>
				</div>
			</div>
		</Dialog.Header>
		<Dialog.Footer>
			<Dialog.Close
				class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
			>
				{cancelLabel}
			</Dialog.Close>
			<button
				onclick={onconfirm}
				disabled={isLoading}
				class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
			>
				{isLoading ? 'Deleting…' : confirmLabel}
			</button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
