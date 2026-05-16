<script lang="ts">
	import { DropdownMenu } from 'bits-ui'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { ChevronRight, Check } from 'lucide-svelte'
	import type { Snippet } from 'svelte'
	import type { MenuItem } from '$lib/types/menu'

	let {
		items = [],
		align = 'end',
		children
	} = $props<{
		items: MenuItem[]
		align?: 'start' | 'center' | 'end'
		children?: Snippet
	}>()

	const navigate = (item: MenuItem) => {
		if ('onclick' in item && item.onclick) {
			item.onclick()
		}
		if ('href' in item && item.href) {
			goto(resolve(item.href))
		}
	}
</script>

{#snippet renderItems(menuItems: MenuItem[])}
	{#each menuItems as item, i (i)}
		{#if 'type' in item && item.type === 'header'}
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading class="px-2 py-1.5 text-xs font-semibold text-slate-500">
					{item.label}
				</DropdownMenu.GroupHeading>
			</DropdownMenu.Group>
		{:else if 'type' in item && item.type === 'separator'}
			<div class="my-1 h-px bg-slate-100 dark:bg-slate-800"></div>
		{:else if 'children' in item && item.children}
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger
					class="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 transition-colors hover:cursor-pointer hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
				>
					{#if item.icon}
						<item.icon class="h-4 w-4 text-slate-400" />
					{/if}
					{item.label}
					<ChevronRight class="ml-auto h-3.5 w-3.5 text-slate-400" />
				</DropdownMenu.SubTrigger>
				<DropdownMenu.Portal>
					<DropdownMenu.SubContent
						class="z-60 min-w-40 rounded-md border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
						sideOffset={4}
					>
						{@render renderItems(item.children)}
					</DropdownMenu.SubContent>
				</DropdownMenu.Portal>
			</DropdownMenu.Sub>
		{:else}
			<DropdownMenu.Item
				onclick={() => navigate(item)}
				class="flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:cursor-pointer
                    {item.variant === 'danger'
					? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30'
					: item.variant === 'indigo'
						? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30'
						: 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
			>
				{#if item.icon}
					{#if typeof item.icon !== 'function'}
						{@render (item.icon as Snippet)()}
					{:else}
						<item.icon
							class="h-4 w-4 {item.variant === 'default' || !item.variant ? 'text-slate-400' : ''}"
							{...item.iconProps}
						/>
					{/if}
				{:else if item.flag}
					<span class="text-base">{item.flag}</span>
				{/if}

				{item.label}

				{#if item.active}
					<Check class="ml-auto h-4 w-4 text-indigo-500" />
				{/if}
			</DropdownMenu.Item>
		{/if}
	{/each}
{/snippet}

<DropdownMenu.Root>
	<DropdownMenu.Trigger class="focus:outline-none">
		{@render children?.()}
	</DropdownMenu.Trigger>

	<DropdownMenu.Portal>
		<DropdownMenu.Content
			class="z-50 min-w-48 rounded-md border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
			sideOffset={8}
			collisionPadding={22}
			{align}
		>
			{@render renderItems(items)}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
