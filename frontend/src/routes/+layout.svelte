<script lang="ts">
	import '../app.css'
	let { children } = $props()
</script>

<div
	class="flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50 print:block print:h-auto print:overflow-visible"
>
	{@render children()}
</div>
