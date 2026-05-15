<script lang="ts">
	import { untrack } from 'svelte'
	import { CheckCircle2 } from 'lucide-svelte'
	import { updateTenant } from '$lib/api/tenants'
	import { parseHashtags } from '$lib/utils/hashtags'
	import { m } from '$lib/paraglide/messages'
	import type { PageData } from './$types'

	let { data } = $props<{ data: PageData }>()

	let name            = $state(untrack(() => data.brand.name))
	let niche           = $state(untrack(() => data.brand.niche ?? ''))
	let language        = $state(untrack(() => data.brand.language ?? 'pt_BR'))
	let location        = $state(untrack(() => data.brand.location ?? ''))
	let primary_persona = $state(untrack(() => data.brand.primary_persona ?? ''))
	let tone            = $state(untrack(() => data.brand.tone ?? ''))
	let instructions    = $state(untrack(() => data.brand.instructions ?? ''))
	let hashtags_raw    = $state(untrack(() => (data.brand.hashtags ?? []).join(' ')))

	let isSaving = $state(false)
	let saved    = $state(false)
	let errorMsg = $state<string | null>(null)

	async function save(e: SubmitEvent) {
		e.preventDefault()
		if (!name.trim()) { errorMsg = m['settings:error_required_name'](); return }
		errorMsg = null
		isSaving = true
		try {
			await updateTenant(data.tenant, {
				name: name.trim(),
				niche: niche.trim() || null,
				language: language.trim() || 'pt_BR',
				location: location.trim() || null,
				primary_persona: primary_persona.trim() || null,
				tone: tone.trim() || null,
				instructions: instructions.trim() || null,
				hashtags: parseHashtags(hashtags_raw)
			})
			saved = true
			setTimeout(() => (saved = false), 2500)
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : m['globals:error_generic']()
		} finally {
			isSaving = false
		}
	}
</script>

<div class="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">

	<div class="flex flex-col gap-6 lg:flex-row lg:gap-8">
		<div class="lg:w-1/3">
			<h2 class="text-base font-semibold text-slate-900 dark:text-white">{m['settings:brand_identity_title']()}</h2>
			<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{m['settings:brand_identity_desc']()}</p>
		</div>

		<div class="flex-1">
			<form onsubmit={save} class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
				<div class="flex flex-col gap-5">
					<div class="grid gap-5 sm:grid-cols-2">
						<div>
							<label for="brand-name" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
								{m['settings:field_brand_name']()} <span class="text-red-400">*</span>
							</label>
							<input id="brand-name" type="text" bind:value={name} required
								class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
						</div>
						<div>
							<label for="brand-niche" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
								{m['settings:field_niche']()}
							</label>
							<input id="brand-niche" type="text" bind:value={niche} placeholder={m['settings:placeholder_niche']()}
								class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
						</div>
					</div>

					<div class="grid gap-5 sm:grid-cols-2">
						<div>
							<label for="brand-language" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
								{m['settings:field_language']()}
							</label>
							<select id="brand-language" bind:value={language}
								class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
								<option value="pt_BR">{m['settings:lang_pt_br']()}</option>
								<option value="en_US">{m['settings:lang_en_us']()}</option>
								<option value="es_ES">{m['settings:lang_es_es']()}</option>
							</select>
						</div>
						<div>
							<label for="brand-location" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
								{m['settings:field_location']()}
							</label>
							<input id="brand-location" type="text" bind:value={location} placeholder={m['settings:placeholder_location']()}
								class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
						</div>
					</div>

					<div>
						<label for="brand-persona" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							{m['settings:field_persona']()}
						</label>
						<input id="brand-persona" type="text" bind:value={primary_persona} placeholder={m['settings:placeholder_persona']()}
							class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
					</div>

					<div>
						<label for="brand-tone" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							{m['settings:field_tone']()}
						</label>
						<input id="brand-tone" type="text" bind:value={tone} placeholder={m['settings:placeholder_tone']()}
							class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
					</div>

					<div>
						<label for="brand-instructions" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							{m['settings:field_ai_instructions']()}
						</label>
						<textarea id="brand-instructions" bind:value={instructions} rows={4}
							placeholder={m['settings:placeholder_instructions']()}
							class="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"></textarea>
					</div>

					<div>
						<label for="brand-hashtags" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							{m['settings:field_hashtags']()}
						</label>
						<input id="brand-hashtags" type="text" bind:value={hashtags_raw} placeholder={m['settings:placeholder_hashtags']()}
							class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
						<p class="mt-1 text-xs text-slate-400">{m['settings:field_hashtags_hint']()}</p>
					</div>

					{#if errorMsg}
						<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{errorMsg}</p>
					{/if}

					<div class="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
						<button type="submit" disabled={isSaving}
							class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
							{isSaving ? m['settings:saving']() : m['settings:save_changes']()}
						</button>
						{#if saved}
							<span class="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
								<CheckCircle2 class="h-4 w-4" /> {m['settings:saved']()}
							</span>
						{/if}
					</div>
				</div>
			</form>
		</div>
	</div>

</div>
