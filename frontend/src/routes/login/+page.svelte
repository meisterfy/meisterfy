<script lang="ts">
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { auth } from '$lib/stores/auth.svelte'
	import { setToken } from '$lib/api/client'
	import { Input } from '$lib/components/ui/input'
	import { Label } from '$lib/components/ui/label'
	import { Button } from '$lib/components/ui/button'
	import { Alert } from '$lib/components/ui/alert'
	import * as m from '$lib/paraglide/messages.js'
	import Seo from '$lib/components/seo.svelte'

	let email = $state('')
	let password = $state('')
	let error = $state<string | null>(null)
	let loading = $state(false)

	async function submit(e: SubmitEvent) {
		e.preventDefault()
		error = null
		loading = true
		try {
			const res = await fetch('/auth/login', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			})
			const data = await res.json()
			if (!res.ok) {
				error = data.error ?? m['auth:login_failed']()
				return
			}
			auth.setToken(data.access_token)
			setToken(data.access_token)
			if (data.user)
				auth.setUser({
					...data.user,
					tenant_id: data.tenant_id ?? data.user.tenant_id ?? '',
					permissions: data.permissions ?? data.user.permissions ?? []
				})
			goto(resolve(data.needs_tenant ? '/tenants/new' : '/'))
		} catch {
			error = m['auth:network_error']()
		} finally {
			loading = false
		}
	}
</script>

<Seo title={m['auth:title']()} description={m['auth:description']?.()} />

<div class="flex h-full flex-col items-center justify-center">
	<div class="absolute top-4 right-4 flex gap-2"></div>
	<div
		class="border-primary/20 to-primary-700/10 relative z-10 flex w-full max-w-sm
			flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border-2 bg-linear-to-t from-transparent
			px-8 py-12 shadow-lg lg:max-w-lg lg:gap-6"
	>
		<div class="w-28">
			<img src="/logo.svg" class="h-full w-full object-contain" alt={m['auth:description']()} />
		</div>
		<form onsubmit={submit} class="flex w-xs max-w-full flex-col gap-4 lg:gap-6">
			<Label class="flex flex-col gap-1">
				{m['auth:email']()}
				<Input
					type="email"
					placeholder={m['auth:email_placeholder']()}
					bind:value={email}
					required
				/>
			</Label>
			<Label class="flex flex-col gap-1">
				{m['auth:password']()}
				<Input type="password" bind:value={password} required />
			</Label>
			{#if error}
				<Alert variant="destructive">
					{error}
				</Alert>
			{/if}
			<Button type="submit" disabled={loading}>
				{loading ? m['auth:signing_in']() : m['auth:sign_in']()}
			</Button>
		</form>
		<div
			class="absolute top-0 left-0 -z-10 h-full w-full bg-linear-to-tr
			from-transparent via-transparent via-60% to-white/5"
		></div>
		<div
			class="bg-primary/5 absolute top-0 left-0 -z-10 h-full w-full
			rounded-[inherit] backdrop-blur-lg"
		></div>
	</div>
	<div
		class="bg-primary fixed top-1/2 left-1/2 z-0 mt-[-256px] ml-[-256px]
		h-[512px] w-[512px] rounded-full opacity-10 blur-3xl lg:mt-[-512px] lg:ml-[-512px]
		lg:opacity-5 xl:h-[1024px] xl:w-[1024px]"
	></div>
</div>
