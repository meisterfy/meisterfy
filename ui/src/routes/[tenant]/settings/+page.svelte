<script lang="ts">
	import { enhance } from '$app/forms';
	import { Settings, Link2, Link2Off, ExternalLink, CheckCircle2, XCircle, Clock } from 'lucide-svelte';
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

	const integrations = [
		{
			id: 'google-ads',
			name: 'Google Ads',
			description: 'Search & display campaign management via Google Ads API.',
			logo: '🔍',
			connected: data.integrations.googleAds.connected,
			authHref: `/${data.tenant}/settings` + '#google-ads',
		},
		{
			id: 'meta',
			name: 'Meta (Instagram / Facebook)',
			description: 'Post scheduling and publishing via Meta Graph API.',
			logo: '📘',
			connected: false,
			soon: true,
		},
		{
			id: 'canva',
			name: 'Canva',
			description: 'Design assets directly from the planner.',
			logo: '🎨',
			connected: false,
			soon: true,
		},
	];
</script>

<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 w-full">

	<!-- Header -->
	<div class="mb-8 flex items-center gap-3">
		<Settings class="h-6 w-6 text-slate-400" />
		<div>
			<h1 class="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
			<p class="text-sm text-slate-500 dark:text-slate-400">
				Client configuration and integrations
			</p>
		</div>
	</div>

	<!-- Brand section -->
	<section class="mb-8">
		<h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Client</h2>
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
					<p class="mt-1 text-xs text-slate-400">
						Found in Google Ads → Admin → Account settings.
					</p>
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
	</section>

	<!-- Integrations section -->
	<section class="mb-8">
		<h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Integrations</h2>
		<div class="flex flex-col gap-3">
			{#each integrations as integration}
				<div class="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 {integration.soon ? 'opacity-60' : ''}">
					<div class="text-2xl mt-0.5">{integration.logo}</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-0.5">
							<span class="font-semibold text-slate-900 dark:text-white text-sm">{integration.name}</span>
							{#if integration.soon}
								<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
									Coming soon
								</span>
							{:else if integration.connected}
								<span class="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
									<CheckCircle2 class="h-3 w-3" /> Connected
								</span>
							{:else}
								<span class="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
									<XCircle class="h-3 w-3" /> Not connected
								</span>
							{/if}
						</div>
						<p class="text-sm text-slate-500 dark:text-slate-400">{integration.description}</p>

						{#if integration.id === 'google-ads' && !integration.soon}
							<div class="mt-3 flex items-center gap-3">
								{#if integration.connected}
									<a
										href="/{data.tenant}/settings/google-ads/disconnect"
										class="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
									>
										<Link2Off class="h-4 w-4" /> Disconnect
									</a>
									<span class="text-slate-300 dark:text-slate-700">|</span>
								{/if}
								<a
									href="/api/auth/google-ads"
									class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
								>
									<Link2 class="h-4 w-4" />
									{integration.connected ? 'Re-authorize' : 'Connect Google Ads'}
								</a>
								{#if !data.integrations.googleAds.hasClientId || !data.integrations.googleAds.hasDeveloperToken}
									<p class="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
										<Clock class="h-3.5 w-3.5" /> Set <code class="font-mono">GOOGLE_ADS_CLIENT_ID</code> and <code class="font-mono">GOOGLE_ADS_DEVELOPER_TOKEN</code> in <code class="font-mono">.env</code> first
									</p>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- API Keys section (future BYOK) -->
	<section>
		<h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">AI & API Keys</h2>
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
			<div class="flex items-start gap-3">
				<div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
					<ExternalLink class="h-4 w-4 text-slate-400" />
				</div>
				<div>
					<p class="text-sm font-semibold text-slate-900 dark:text-white">API keys</p>
					<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
						Currently managed via <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">.env</code>.
						A dedicated UI for key management (BYOK) is planned for the desktop version.
					</p>
				</div>
			</div>
		</div>
	</section>
</div>
