<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { AlertTriangle } from 'lucide-svelte';

	let {
		open = $bindable(false),
		title = 'Are you sure?',
		description = 'This action cannot be undone.',
		confirmLabel = 'Delete',
		cancelLabel = 'Cancel',
		isLoading = false,
		onconfirm,
	}: {
		open: boolean;
		title?: string;
		description?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		isLoading?: boolean;
		onconfirm: () => void;
	} = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="mb-4 flex items-start gap-3">
				<div
					class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
				>
					<AlertTriangle class="h-5 w-5 text-red-600 dark:text-red-400" />
				</div>
				<div>
					<Dialog.Title class="text-base font-bold text-slate-900 dark:text-white"
						>{title}</Dialog.Title
					>
					<Dialog.Description class="mt-1 text-sm text-slate-500 dark:text-slate-400"
						>{description}</Dialog.Description
					>
				</div>
			</div>
			<div class="mt-6 flex justify-end gap-3">
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
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
