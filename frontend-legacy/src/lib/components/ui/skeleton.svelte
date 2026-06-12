<script lang="ts">
	let { class: className = '', ...rest } = $props<{ class?: string }>()
</script>

<div class="animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 {className}" {...rest}></div>
