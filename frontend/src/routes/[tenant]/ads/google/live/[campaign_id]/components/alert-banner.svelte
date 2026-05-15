<script lang="ts">
	import { TriangleAlert, OctagonAlert } from 'lucide-svelte'
	interface Alert {
		id: string
		level: string
		type: string
		message: string
		action_suggested?: string
	}

	let { data } = $props<{ data: { openAlerts: Alert[] } }>()
</script>

<div
    class="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10"
>
    {#each data.openAlerts as alert}
        <div class="flex items-start gap-3">
            {#if alert.level === 'CRITICAL'}
                <OctagonAlert class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            {:else}
                <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            {/if}
            <div>
                <span class="mr-2 text-xs font-bold tracking-wide text-red-700 uppercase dark:text-red-300">
                    {alert.level}
                </span>
                <span class="text-sm text-red-800 dark:text-red-200">
                    {alert.message}
                </span>
                {#if alert.action_suggested}
                    <p class="mt-0.5 text-xs text-red-600 dark:text-red-400">
                        {alert.action_suggested}
                    </p>
                {/if}
            </div>
        </div>
    {/each}
</div>