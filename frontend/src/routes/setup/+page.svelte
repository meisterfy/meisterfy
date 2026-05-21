<script lang="ts">
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { auth } from '$lib/stores/auth.svelte'
	import { setToken } from '$lib/api/client'
	import { Input } from '$lib/components/ui/input'
	import { Label } from '$lib/components/ui/label'
	import { Button } from '$lib/components/ui/button'
	import { Alert } from '$lib/components/ui/alert'
	import { BarChart3, Sparkles } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'

	let step = $state<1 | 2>(1)
	let needsTenant = $state(false)

	let name = $state('')
	let email = $state('')
	let password = $state('')
	let error = $state<string | null>(null)
	let loading = $state(false)

	async function submit(e: SubmitEvent) {
		e.preventDefault()
		error = null
		loading = true
		try {
			const res = await fetch('/setup', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, password })
			})
			const data = await res.json()
			if (!res.ok) {
				error = data.error ?? 'Setup failed'
				return
			}
			if (data.access_token) {
				auth.setToken(data.access_token)
				setToken(data.access_token)
				if (data.user)
					auth.setUser({
						...data.user,
						tenant_id: data.tenant_id ?? data.user.tenant_id ?? '',
						permissions: data.permissions ?? data.user.permissions ?? []
					})
			}
			needsTenant = !!data.needs_tenant
			step = 2
		} catch {
			error = 'Network error'
		} finally {
			loading = false
		}
	}

	function skip() {
		goto(resolve(needsTenant ? '/tenants/new' : '/'))
	}
</script>

<div class="flex h-full items-center justify-center">
	<div
		class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900"
	>
		{#if step === 1}
			<h1 class="mb-2 text-xl font-bold text-slate-900 dark:text-white">Welcome to Maestro</h1>
			<p class="mb-6 text-sm text-slate-500 dark:text-slate-400">
				Create the first admin account to get started.
			</p>
			<form onsubmit={submit} class="flex flex-col gap-4">
				<Label class="flex flex-col gap-1">
					Name
					<Input type="text" bind:value={name} required />
				</Label>
				<Label class="flex flex-col gap-1">
					Email
					<Input type="email" bind:value={email} required />
				</Label>
				<Label class="flex flex-col gap-1">
					Password
					<Input type="password" bind:value={password} required minlength={8} />
				</Label>
				{#if error}
					<Alert variant="destructive">{error}</Alert>
				{/if}
				<Button type="submit" disabled={loading}>
					{loading ? 'Creating account…' : 'Create account'}
				</Button>
			</form>
		{:else}
			<h1 class="mb-2 text-xl font-bold text-slate-900 dark:text-white">Configure your tools</h1>
			<p class="mb-6 text-sm text-slate-500 dark:text-slate-400">
				Connect your integrations now or later in Settings.
			</p>

			<div class="flex flex-col gap-3">
				<div
					class="flex items-center gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
				>
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20"
					>
						<BarChart3 class="h-5 w-5 text-blue-600 dark:text-blue-400" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-slate-900 dark:text-white">{m['settings:nav_google_ads']()}</p>
						<p class="text-xs text-slate-500 dark:text-slate-400">
							Connect your ad account to track campaigns
						</p>
					</div>
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href="/auth/google-ads/start"
						class="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
					>
						Connect
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</div>

				<div
					class="flex items-center gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
				>
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/20"
					>
						<Sparkles class="h-5 w-5 text-violet-600 dark:text-violet-400" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-slate-900 dark:text-white">AI Provider</p>
						<p class="text-xs text-slate-500 dark:text-slate-400">
							Add an API key to enable content generation
						</p>
					</div>
					<button
						onclick={() => goto(resolve('/settings/integrations'))}
						class="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
					>
						Configure
					</button>
				</div>
			</div>

			<Button
				onclick={skip}
				class="mt-6 w-full border border-slate-300 bg-transparent text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
			>
				Skip for now
			</Button>
		{/if}
	</div>
</div>
