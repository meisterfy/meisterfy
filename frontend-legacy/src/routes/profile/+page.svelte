<script lang="ts">
	import { untrack } from 'svelte'
	import { resolve } from '$app/paths'
	import { CircleCheck, User, Key, Globe, Clock, ArrowLeft } from 'lucide-svelte'
	import { Input } from '$lib/components/ui/input'
	import * as Select from '$lib/components/ui/select'
	import { auth } from '$lib/stores/auth.svelte'
	import { updateMe, changePassword } from '$lib/api/users'
	import { m } from '$lib/paraglide/messages'

	const locales: Record<string, string> = {
		pt_BR: 'Portuguese (BR)',
		en_US: 'English (US)',
		es_ES: 'Spanish'
	}

	const timezones: Record<string, string> = {
		'America/Sao_Paulo': 'America/Sao_Paulo (BRT)',
		'America/New_York': 'America/New_York (EST/EDT)',
		'Europe/London': 'Europe/London (GMT/BST)',
		UTC: 'UTC'
	}

	// ── Profile card ──────────────────────────────────────────────────────────
	let name = $state(untrack(() => auth.user?.name ?? ''))
	let email = $state(untrack(() => auth.user?.email ?? ''))
	let locale = $state(untrack(() => auth.user?.locale ?? 'pt_BR'))
	let timezone = $state(untrack(() => auth.user?.timezone ?? 'America/Sao_Paulo'))

	let profileSaving = $state(false)
	let profileSaved = $state(false)
	let profileError = $state<string | null>(null)

	async function saveProfile(e: SubmitEvent) {
		e.preventDefault()
		profileError = null
		profileSaving = true
		try {
			const updated = await updateMe({ name, email, locale, timezone })
			auth.setUser({ ...auth.user!, ...updated })
			profileSaved = true
			setTimeout(() => (profileSaved = false), 2500)
		} catch (err) {
			profileError = err instanceof Error ? err.message : 'Save failed'
		} finally {
			profileSaving = false
		}
	}

	// ── Password card ─────────────────────────────────────────────────────────
	let currentPassword = $state('')
	let newPassword = $state('')
	let confirmPassword = $state('')

	let pwSaving = $state(false)
	let pwSaved = $state(false)
	let pwError = $state<string | null>(null)

	async function savePassword(e: SubmitEvent) {
		e.preventDefault()
		pwError = null
		if (newPassword !== confirmPassword) {
			pwError = 'New passwords do not match'
			return
		}
		pwSaving = true
		try {
			const res = await changePassword({
				current_password: currentPassword,
				new_password: newPassword
			})
			// The password change revoked the old token; adopt the fresh one so
			// this session keeps working.
			if (res?.access_token) auth.setToken(res.access_token)
			currentPassword = ''
			newPassword = ''
			confirmPassword = ''
			pwSaved = true
			setTimeout(() => (pwSaved = false), 2500)
		} catch (err) {
			pwError = err instanceof Error ? err.message : 'Password change failed'
		} finally {
			pwSaving = false
		}
	}
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950">
	<header
		class="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-900"
	>
		<div class="mx-auto flex max-w-3xl items-center gap-4">
			<a
				href={resolve('/')}
				class="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
				title={m['globals:profile_back_aria']()}
			>
				<ArrowLeft class="h-5 w-5" />
			</a>
			<div>
				<h1 class="text-xl font-bold text-slate-900 dark:text-white">
					{m['globals:profile_title']()}
				</h1>
				<p class="text-sm text-slate-500 dark:text-slate-400">{m['globals:profile_subtitle']()}</p>
			</div>
		</div>
	</header>

	<main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
		<!-- Personal Info + Preferences card -->
		<div
			class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
		>
			<div
				class="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800"
			>
				<User class="h-5 w-5 text-indigo-500" />
				<h2 class="text-lg font-semibold text-slate-900 dark:text-white">
					{m['globals:profile_personal_info']()}
				</h2>
			</div>

			<form onsubmit={saveProfile} class="flex flex-col gap-5">
				<div class="grid gap-5 sm:grid-cols-2">
					<div>
						<label
							for="profile-name"
							class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
						>
							{m['globals:profile_full_name']()} <span class="text-red-400">*</span>
						</label>
						<Input id="profile-name" type="text" bind:value={name} required />
					</div>
					<div>
						<label
							for="profile-email"
							class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
						>
							Email <span class="text-red-400">*</span>
						</label>
						<Input id="profile-email" type="email" bind:value={email} required />
					</div>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<div>
						<label
							for="profile-locale"
							class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase"
						>
							<Globe class="h-3.5 w-3.5" /> Language
						</label>
						<Select.Root type="single" bind:value={locale}>
							<Select.Trigger id="profile-locale" class="w-full">
								{locales[locale] ?? locale}
							</Select.Trigger>
							<Select.Content>
								{#each Object.entries(locales) as [key, label] (key)}
									<Select.Item value={key}>{label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div>
						<label
							for="profile-timezone"
							class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase"
						>
							<Clock class="h-3.5 w-3.5" /> Timezone
						</label>
						<Select.Root type="single" bind:value={timezone}>
							<Select.Trigger id="profile-timezone" class="w-full">
								{timezones[timezone] ?? timezone}
							</Select.Trigger>
							<Select.Content>
								{#each Object.entries(timezones) as [key, label] (key)}
									<Select.Item value={key}>{label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				{#if profileError}
					<p
						class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
					>
						{profileError}
					</p>
				{/if}

				<div class="flex items-center gap-3">
					<button
						type="submit"
						disabled={profileSaving}
						class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
					>
						{profileSaving ? 'Saving…' : m['globals:profile_save_changes']()}
					</button>
					{#if profileSaved}
						<span class="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
							<CircleCheck class="h-4 w-4" /> Saved
						</span>
					{/if}
				</div>
			</form>
		</div>

		<!-- Password card -->
		<div
			class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
		>
			<div
				class="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800"
			>
				<Key class="h-5 w-5 text-indigo-500" />
				<h2 class="text-lg font-semibold text-slate-900 dark:text-white">
					{m['globals:profile_change_password']()}
				</h2>
			</div>

			<form onsubmit={savePassword} class="flex flex-col gap-5">
				<div>
					<label
						for="profile-current-pwd"
						class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
					>
						{m['globals:profile_current_password']()}
					</label>
					<Input id="profile-current-pwd" type="password" bind:value={currentPassword} required />
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<div>
						<label
							for="profile-new-pwd"
							class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
						>
							{m['globals:profile_new_password']()}
						</label>
						<Input id="profile-new-pwd" type="password" bind:value={newPassword} required />
					</div>
					<div>
						<label
							for="profile-confirm-pwd"
							class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
						>
							{m['globals:profile_confirm_password']()}
						</label>
						<Input id="profile-confirm-pwd" type="password" bind:value={confirmPassword} required />
					</div>
				</div>

				{#if pwError}
					<p
						class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
					>
						{pwError}
					</p>
				{/if}

				<div class="flex items-center gap-3">
					<button
						type="submit"
						disabled={pwSaving}
						class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
					>
						{pwSaving ? 'Saving…' : m['globals:profile_change_password']()}
					</button>
					{#if pwSaved}
						<span class="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
							<CircleCheck class="h-4 w-4" />
							{m['globals:profile_password_updated']()}
						</span>
					{/if}
				</div>
			</form>
		</div>
	</main>
</div>
