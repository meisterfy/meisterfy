<script lang="ts">
	let { value = $bindable([]) } = $props()
</script>

<div data-testid="platform-select" data-value={JSON.stringify(value)}></div>
