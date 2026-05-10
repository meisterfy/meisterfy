<script lang="ts">
	import { goto } from '$app/navigation'
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
			if (data.user) auth.setUser(data.user)
			goto(data.needs_tenant ? '/tenants/new' : '/')
		} catch {
			error = m['auth:network_error']()
		} finally {
			loading = false
		}
	}
</script>

<Seo title={m['auth:title']()} description={m['auth:description']?.()} />

<div class="flex flex-col h-full items-center justify-center">
	<div class="absolute top-4 right-4 flex gap-2">
	</div>
	<div
		class="relative w-full flex flex-col items-center overflow-hidden justify-center 
			gap-4 lg:gap-6 max-w-sm lg:max-w-lg px-8 py-12 rounded-2xl shadow-lg border-2 
			border-primary/20 bg-linear-to-t from-transparent to-primary-700/10 z-10"
	>
		<div class="w-28">
			<img
				src="/logo.svg"
				class="w-full h-full object-contain"
				alt={m['auth:description']()}
			/>
		</div>
		<form onsubmit={submit} class="w-xs max-w-full flex flex-col gap-4 lg:gap-6">
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
				<Input
					type="password"
					bind:value={password}
					required
				/>
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
		<div class="absolute w-full h-full top-0 left-0 bg-linear-to-tr from-transparent 
			via-60% via-transparent to-white/5 -z-10"></div>
		<div class="absolute w-full h-full top-0 left-0 bg-primary/5 backdrop-blur-lg 
			rounded-[inherit] -z-10"></div>
	</div>
	<div class="fixed w-[512px] h-[512px] xl:w-[1024px] xl:h-[1024px] bg-primary blur-3xl 
		opacity-10 lg:opacity-5 rounded-full top-1/2 left-1/2 ml-[-256px] mt-[-256px] 
		lg:ml-[-512px] lg:mt-[-512px] z-0"></div>
</div>
