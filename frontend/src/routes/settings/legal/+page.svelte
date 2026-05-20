<script lang="ts">
	import { ScrollText, Plus, Trash2 } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import { toast } from 'svelte-sonner'
	import type { PageData } from './$types'
	import type { LegalVersion, LegalBlock } from '$lib/api/legal'
	import { createLegalVersion, updateLegalVersion } from '$lib/api/legal'
	import SectionTitle from '$lib/components/ui/title/section-title.svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import * as Select from '$lib/components/ui/select'

	let { data } = $props<{ data: PageData }>()

	const LOCALES = ['en', 'pt-BR']

	let versions = $state<LegalVersion[]>([])
	let isLoading = $state(true)

	$effect(() => {
		Promise.resolve(data.versions).then((v) => {
			versions = v
			isLoading = false
		})
	})

	let selectedId = $state<string | null>(null)
	let isNew = $state(false)

	// editor state
	let editFallbackLocale = $state('pt-BR')
	let editEffectiveAt = $state('')
	let editLocale = $state('en')
	let editTranslations = $state<Record<string, LegalBlock[]>>({ en: [], 'pt-BR': [] })
	let saving = $state(false)

	function newEmptyVersion(): void {
		isNew = true
		selectedId = null
		editFallbackLocale = 'pt-BR'
		editEffectiveAt = new Date().toISOString().slice(0, 10)
		editLocale = 'en'
		editTranslations = { en: [{ title: '', content: '' }], 'pt-BR': [{ title: '', content: '' }] }
	}

	function selectVersion(v: LegalVersion): void {
		isNew = false
		selectedId = v.id
		editFallbackLocale = v.fallback_locale
		editEffectiveAt = v.effective_at.slice(0, 10)
		editLocale = 'en'
		// deep-clone so edits don't mutate the list
		const cloned: Record<string, LegalBlock[]> = {}
		for (const [locale, blocks] of Object.entries(v.translations)) {
			cloned[locale] = blocks.map((b) => ({ ...b }))
		}
		// ensure both locales exist
		for (const loc of LOCALES) {
			if (!cloned[loc]) cloned[loc] = [{ title: '', content: '' }]
		}
		editTranslations = cloned
	}

	function currentBlocks(): LegalBlock[] {
		return editTranslations[editLocale] ?? []
	}

	function addBlock(): void {
		editTranslations = {
			...editTranslations,
			[editLocale]: [...currentBlocks(), { title: '', content: '' }]
		}
	}

	function removeBlock(idx: number): void {
		const updated = currentBlocks().filter((_, i) => i !== idx)
		editTranslations = { ...editTranslations, [editLocale]: updated }
	}

	function updateBlock(idx: number, field: 'title' | 'content', value: string): void {
		const updated = currentBlocks().map((b, i) => (i === idx ? { ...b, [field]: value } : b))
		editTranslations = { ...editTranslations, [editLocale]: updated }
	}

	async function handleSave(): Promise<void> {
		saving = true
		try {
			const body = {
				fallback_locale: editFallbackLocale,
				translations: editTranslations,
				effective_at: editEffectiveAt ? new Date(editEffectiveAt).toISOString() : new Date().toISOString()
			}
			if (isNew) {
				const created = await createLegalVersion(body)
				versions = [created, ...versions]
				selectedId = created.id
				isNew = false
				toast.success(m['settings:legal_toast_created']())
			} else {
				await updateLegalVersion(selectedId!, body)
				versions = versions.map((v) =>
					v.id === selectedId
						? { ...v, fallback_locale: body.fallback_locale, translations: body.translations, effective_at: body.effective_at }
						: v
				)
				toast.success(m['settings:legal_toast_saved']())
			}
		} catch {
			toast.error(m['globals:error_generic']())
		} finally {
			saving = false
		}
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString()
	}
</script>

<div class="flex flex-1 gap-0 overflow-hidden">
	<!-- left panel: version list -->
	<aside class="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
		<div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
			<span class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
				{m['settings:legal_title']()}
			</span>
			<button
				onclick={newEmptyVersion}
				class="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
				title={m['settings:legal_new_version']()}
			>
				<Plus class="h-4 w-4" />
			</button>
		</div>

		<div class="flex-1 overflow-y-auto">
			{#if isLoading}
				<div class="flex flex-col gap-2 p-3">
					{#each Array(3) as _, i (i)}
						<div class="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"></div>
					{/each}
				</div>
			{:else if versions.length === 0 && !isNew}
				<p class="px-4 py-6 text-center text-sm text-slate-400">
					{m['settings:legal_no_versions']()}
				</p>
			{/if}

			{#if isNew}
				<button
					class="w-full border-b border-slate-200 bg-indigo-50 px-4 py-3 text-left dark:border-slate-800 dark:bg-indigo-950/40"
				>
					<p class="text-sm font-medium text-indigo-700 dark:text-indigo-300">
						{m['settings:legal_new_version']()}
					</p>
				</button>
			{/if}

			{#each versions as v (v.id)}
				<button
					onclick={() => selectVersion(v)}
					class="w-full border-b border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 {selectedId === v.id && !isNew
						? 'bg-slate-100 dark:bg-slate-800'
						: ''}"
				>
					<p class="text-sm font-medium text-slate-900 dark:text-white">
						{m['settings:legal_version_label']({ version: v.version })}
					</p>
					<p class="mt-0.5 text-xs text-slate-500">
						{m['settings:legal_effective_label']({ date: formatDate(v.effective_at) })}
					</p>
				</button>
			{/each}
		</div>
	</aside>

	<!-- right panel: editor -->
	<main class="flex flex-1 flex-col overflow-y-auto">
		{#if !selectedId && !isNew}
			<div class="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
				<ScrollText class="h-10 w-10" />
				<p class="text-sm">{m['settings:legal_no_versions']()}</p>
				<Button onclick={newEmptyVersion} class="mt-2 h-9 px-4 text-sm">
					{m['settings:legal_new_version']()}
				</Button>
			</div>
		{:else}
			<div class="flex flex-col gap-6 p-6">
				<SectionTitle title={isNew ? m['settings:legal_new_version']() : m['settings:legal_title']()}>
					{#snippet icon()}
						<ScrollText class="text-muted-foreground h-5 w-5" />
					{/snippet}
					<Button onclick={handleSave} disabled={saving} class="h-9 px-4 text-sm">
						{saving ? '…' : isNew ? m['settings:legal_create']() : m['globals:save']()}
					</Button>
				</SectionTitle>

				<!-- meta fields -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="effective-at" class="text-muted-foreground mb-1.5 block text-xs font-semibold uppercase tracking-wide">
							{m['settings:legal_field_effective_at']()}
						</label>
						<Input id="effective-at" type="date" bind:value={editEffectiveAt} />
					</div>
					<div>
						<label for="fallback-locale" class="text-muted-foreground mb-1.5 block text-xs font-semibold uppercase tracking-wide">
							{m['settings:legal_field_fallback_locale']()}
						</label>
						<Select.Root type="single" bind:value={editFallbackLocale}>
							<Select.Trigger id="fallback-locale" class="w-full">
								{editFallbackLocale}
							</Select.Trigger>
							<Select.Content>
								{#each LOCALES as loc (loc)}
									<Select.Item value={loc}>{loc}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<!-- locale tabs -->
				<div>
					<div class="border-border mb-4 flex gap-1 border-b">
						{#each LOCALES as loc (loc)}
							<button
								onclick={() => (editLocale = loc)}
								class="px-4 pb-2 text-sm font-medium transition-colors {editLocale === loc
									? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
									: 'text-muted-foreground hover:text-foreground'}"
							>
								{loc}
							</button>
						{/each}
					</div>

					<!-- blocks -->
					<div class="flex flex-col gap-4">
						{#each currentBlocks() as block, idx (idx)}
							<div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
								<div class="mb-3 flex items-center justify-between">
									<span class="text-xs font-semibold uppercase tracking-wide text-slate-400">
										{m['settings:legal_block_title']()}
									</span>
									<button
										onclick={() => removeBlock(idx)}
										class="text-muted-foreground hover:text-destructive transition-colors"
										title={m['settings:legal_remove_block']()}
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
								<Input
									class="mb-3"
									placeholder={m['settings:legal_block_title']()}
									value={block.title}
									oninput={(e) => updateBlock(idx, 'title', (e.target as HTMLInputElement).value)}
								/>
								<textarea
									class="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700"
									rows={6}
									placeholder={m['settings:legal_block_content']()}
									value={block.content}
									oninput={(e) => updateBlock(idx, 'content', (e.target as HTMLTextAreaElement).value)}
								></textarea>
							</div>
						{/each}

						<button
							onclick={addBlock}
							class="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:hover:border-indigo-600 dark:hover:text-indigo-400"
						>
							<Plus class="h-4 w-4" />
							{m['settings:legal_add_block']()}
						</button>
					</div>
				</div>
			</div>
		{/if}
	</main>
</div>
