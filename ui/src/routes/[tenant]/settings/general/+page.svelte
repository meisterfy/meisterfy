<script lang="ts">
	import { enhance } from '$app/forms';
	import { CheckCircle2, Settings } from 'lucide-svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let isSaving = $state(false);
	let saved = $state(false);

	$effect(() => {
		if (form?.success) {
			saved = true;
			setTimeout(() => (saved = false), 2500);
		}
	});
</script>

<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 w-full">
	<div class="mb-8 flex items-center gap-3">
		<Settings class="h-6 w-6 text-slate-400" />
		<div>
			<h1 class="text-xl font-bold text-slate-900 dark:text-white">General</h1>
			<p class="text-sm text-slate-500 dark:text-slate-400">Client branding and identification</p>
		</div>
	</div>

	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<form
			method="POST"
			action="?/saveBrand"
			use:enhance={() => {
				isSaving = true;
				return async ({ update }) => {
					await update();
					isSaving = false;
				};
			}}
			class="flex flex-col gap-5"
		>
			<div class="grid gap-5 sm:grid-cols-2">
				<div>
					<label for="brand-name" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
						Brand name <span class="text-red-400">*</span>
					</label>
					<input
						id="brand-name"
						name="name"
						type="text"
						value={String(data.brand.name ?? '')}
						required
						class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
					/>
				</div>
				<div>
					<label for="brand-niche" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
						Niche / segment
					</label>
					<input
						id="brand-niche"
						name="niche"
						type="text"
						value={String(data.brand.niche ?? '')}
						placeholder="e.g. Automotive, SaaS, Retail"
						class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
					/>
				</div>
			</div>

			<div>
				<label for="google-ads-id" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
					Google Ads customer ID
				</label>
				<input
					id="google-ads-id"
					name="google_ads_id"
					type="text"
					value={String(data.brand.google_ads_id ?? '')}
					placeholder="123-456-7890"
					class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
				/>
				<p class="mt-1 text-xs text-slate-400">Found in Google Ads → Admin → Account settings.</p>
			</div>

			{#if form?.error}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
					{form.error}
				</p>
			{/if}

			<div class="flex items-center gap-3">
				<button
					type="submit"
					disabled={isSaving}
					class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
				>
					{isSaving ? 'Saving…' : 'Save changes'}
				</button>
				{#if saved}
					<span class="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
						<CheckCircle2 class="h-4 w-4" /> Saved
					</span>
				{/if}
			</div>
		</form>
	</div>
</div>
