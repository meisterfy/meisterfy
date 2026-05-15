<script lang="ts">
	import '../app.css'
	import { Toaster } from '$lib/components/ui/sonner'
	import { ModeWatcher } from 'mode-watcher'
	let { children } = $props()
</script>

<div
	class="flex min-h-screen w-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50 print:block print:h-auto print:overflow-visible"
>
	{@render children()}
	<Toaster richColors closeButton position="bottom-right" />
	<ModeWatcher />
</div>
