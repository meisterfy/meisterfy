<script lang="ts">
	let { rows = 5, twoPanel = false } = $props<{ rows?: number; twoPanel?: boolean }>()
</script>

<div class="flex flex-col gap-6 p-6 animate-pulse">
	<!-- header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class="h-5 w-5 rounded bg-slate-200 dark:bg-slate-700"></div>
			<div class="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700"></div>
		</div>
		<div class="h-9 w-28 rounded-md bg-slate-200 dark:bg-slate-700"></div>
	</div>

	{#if twoPanel}
		<!-- two-panel: roles layout -->
		<div class="grid gap-6 lg:grid-cols-[260px_1fr]">
			<div class="flex flex-col gap-2">
				{#each Array(4) as _}
					<div class="h-12 w-full rounded-lg bg-slate-100 dark:bg-slate-800"></div>
				{/each}
			</div>
			<div class="rounded-xl border border-slate-200 dark:border-slate-800">
				<div class="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
					<div class="h-5 w-32 rounded bg-slate-200 dark:bg-slate-700"></div>
				</div>
				<div class="grid gap-4 p-5 sm:grid-cols-2">
					{#each Array(6) as _}
						<div class="flex flex-col gap-2">
							<div class="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800"></div>
							{#each Array(4) as _}
								<div class="h-5 w-full rounded bg-slate-100 dark:bg-slate-800"></div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{:else}
		<!-- table layout: users / audit -->
		<div class="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
			<div class="grid border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/50"
				style="grid-template-columns: repeat({rows > 3 ? 5 : 4}, 1fr)">
				{#each Array(rows > 3 ? 5 : 4) as _}
					<div class="h-3.5 w-20 rounded bg-slate-200 dark:bg-slate-700"></div>
				{/each}
			</div>
			{#each Array(rows) as _}
				<div class="grid items-center border-t border-slate-200 px-4 py-3 dark:border-slate-800"
					style="grid-template-columns: repeat({rows > 3 ? 5 : 4}, 1fr)">
					{#each Array(rows > 3 ? 5 : 4) as _}
						<div class="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800"></div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>
