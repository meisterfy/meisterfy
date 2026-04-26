<script lang="ts">
	import { untrack } from 'svelte';
	import { CheckCircle2, Settings } from 'lucide-svelte';
	import { updateTenant } from '$lib/api/tenants';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let name         = $state(untrack(() => data.brand.name));
	let niche        = $state(untrack(() => data.brand.niche));
	let google_ads_id = $state(untrack(() => data.brand.google_ads_id));
	let isSaving     = $state(false);
	let saved        = $state(false);
	let errorMsg     = $state<string | null>(null);

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) { errorMsg = 'Brand name is required'; return; }
		errorMsg = null;
		isSaving = true;
		try {
			await updateTenant(data.tenant, {
				name: name.trim(),
				niche: niche.trim() || null,
				google_ads_id: google_ads_id.trim() || null,
			});
			saved = true;
			setTimeout(() => (saved = false), 2500);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Save failed';
		} finally {
			isSaving = false;
		}
	}
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
		<form onsubmit={save} class="flex flex-col gap-5">
			<div class="grid gap-5 sm:grid-cols-2">
				<div>
					<label for="brand-name" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
						Brand name <span class="text-red-400">*</span>
					</label>
					<input
						id="brand-name"
						type="text"
						bind:value={name}
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
						type="text"
						bind:value={niche}
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
					type="text"
					bind:value={google_ads_id}
					placeholder="123-456-7890"
					class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
				/>
				<p class="mt-1 text-xs text-slate-400">Found in Google Ads → Admin → Account settings.</p>
			</div>

			{#if errorMsg}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{errorMsg}</p>
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
