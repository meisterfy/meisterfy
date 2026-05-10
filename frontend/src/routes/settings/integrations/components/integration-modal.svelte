<script lang="ts">
	import { Dialog } from 'bits-ui'
	import { Eye, EyeOff, FlaskConical } from 'lucide-svelte'
	import ProviderIcon from '$lib/components/ui/provider-icon.svelte'
	import MultiSelect from '$lib/components/ui/multiselect/multi-select.svelte'
	import type { IntegrationManager } from '../integrations.svelte'

	let { manager, onSave, onTest }: {
		manager: IntegrationManager
		onSave: (e: SubmitEvent) => void
		onTest: () => void
	} = $props()
</script>

<Dialog.Root bind:open={manager.showModal}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
		>
			{#if manager.activeProvider}
				<div class="flex items-center gap-3 mb-4">
					<div class="h-10 w-10 shrink-0 text-slate-900 dark:text-white">
						<ProviderIcon
							provider={manager.activeProvider.provider}
							logoSvg={manager.activeProvider.logo_svg}
							logoPng={manager.activeProvider.logo_png}
						/>
					</div>
					<div>
						<Dialog.Title class="text-base font-bold text-slate-900 dark:text-white">
							{manager.editingId ? `Edit ${manager.activeProvider.display_name}` : `Add ${manager.activeProvider.display_name}`}
						</Dialog.Title>
						<Dialog.Description class="text-sm text-slate-500 dark:text-slate-400">
							{manager.activeProvider.description}
						</Dialog.Description>
					</div>
				</div>

				<form onsubmit={onSave} class="flex flex-col gap-4">
					<!-- Name -->
					<div>
						<label
							for="int-name"
							class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
						>
							Name <span class="text-red-400">*</span>
						</label>
						<input
							id="int-name"
							type="text"
							bind:value={manager.formName}
							placeholder="e.g. Agency – Default Account"
							required
							class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
						/>
					</div>

					<!-- Dynamic fields -->
					{#if manager.activeProvider.config_fields?.length}
						<div class="flex flex-col gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
							<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
								Configuration
							</p>
							{#each manager.activeProvider.config_fields as field (field.key)}
								<div>
									<label
										for="f-{field.key}"
										class="mb-1 block text-xs font-semibold text-slate-500"
									>
										{field.label}{#if field.required}
											<span class="text-red-400">*</span>{/if}
									</label>
									<input
										id="f-{field.key}"
										type={field.type === 'password'
											? manager.showSecrets[field.key]
												? 'text'
												: 'password'
											: field.type === 'url'
												? 'url'
												: 'text'}
										bind:value={manager.form[field.key]}
										placeholder={field.placeholder ?? ''}
										required={field.required}
										class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
									/>
									{#if field.help_text}
										<p class="mt-0.5 text-xs text-slate-400">{field.help_text}</p>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if manager.activeProvider.credential_fields?.length}
						<div class="flex flex-col gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
							<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
								Credentials
							</p>
							{#each manager.activeProvider.credential_fields as field (field.key)}
								<div>
									<label
										for="c-{field.key}"
										class="mb-1 block text-xs font-semibold text-slate-500"
									>
										{field.label}{#if field.required}
											<span class="text-red-400">*</span>{/if}
									</label>
									<div class="relative">
										<input
											id="c-{field.key}"
											type={field.type === 'password'
												? manager.showSecrets[field.key]
													? 'text'
													: 'password'
												: 'text'}
											bind:value={manager.form[field.key]}
											placeholder={field.placeholder ?? ''}
											required={field.required && !manager.editingId}
											class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 font-mono text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
										/>
										{#if field.type === 'password'}
											<button
												type="button"
												onclick={() => {
													manager.showSecrets[field.key] = !manager.showSecrets[field.key]
												}}
												class="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
											>
												{#if manager.showSecrets[field.key]}<EyeOff class="h-4 w-4" />{:else}<Eye
														class="h-4 w-4"
													/>{/if}
											</button>
										{/if}
									</div>
									{#if field.help_text}
										<p class="mt-0.5 text-xs text-slate-400">{field.help_text}</p>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<div>
						<p class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
							Assign to clients
						</p>
						<MultiSelect
							bind:value={manager.formTenants}
							options={manager.tenantOptions}
							placeholder="Select clients…"
						/>
					</div>

					{#if manager.activeProvider.oauth_flow && !manager.editingId}
						<p
							class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
						>
							After saving, you'll be redirected to authorize via OAuth.
						</p>
					{/if}

					{#if manager.testStatus}
						<div
							class="rounded-lg px-3 py-2 text-sm {manager.testStatus.ok
								? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
								: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}"
						>
							{manager.testStatus.message}
						</div>
					{/if}

					{#if manager.modalError}
						<p
							class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
						>
							{manager.modalError}
						</p>
					{/if}

					<div class="mt-2 flex items-center justify-between gap-3">
						<div>
							{#if manager.editingId}
								<button
									type="button"
									onclick={onTest}
									disabled={manager.isTesting}
									class="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
								>
									<FlaskConical class="h-3.5 w-3.5" />
									{manager.isTesting ? 'Testing…' : 'Test'}
								</button>
							{/if}
						</div>
						<div class="flex gap-3">
							<Dialog.Close
								class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
							>
								Cancel
							</Dialog.Close>
							<button
								type="submit"
								disabled={manager.isSubmitting}
								class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
							>
								{manager.isSubmitting
									? 'Saving…'
									: manager.activeProvider.oauth_flow && !manager.editingId
										? 'Save & Connect'
										: 'Save'}
							</button>
						</div>
					</div>
				</form>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
