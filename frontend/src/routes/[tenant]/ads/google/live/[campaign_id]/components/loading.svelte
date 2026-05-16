<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { LoaderCircle } from 'lucide-svelte'
</script>

<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
	<div
		class="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800"
	>
		<LoaderCircle class="h-5 w-5 animate-spin text-indigo-500" />
		<span class="font-medium text-slate-700 dark:text-slate-200">
			{m['ads:messages.updating_report_data']()}
		</span>
	</div>
</div>
