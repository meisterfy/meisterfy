import { setLocale, getLocale } from '$lib/paraglide/runtime'
import { apiFetch } from '$lib/api/client'

type Locale = 'en' | 'pt-BR'

const SUPPORTED: Locale[] = ['en', 'pt-BR']

function toSafeLocale(raw: string): Locale {
	return (SUPPORTED.includes(raw as Locale) ? raw : 'en') as Locale
}

let _locale = $state<Locale>(toSafeLocale(getLocale()))

export const localeStore = {
	get current(): Locale {
		return _locale
	},

	init(raw: string) {
		const locale = toSafeLocale(raw)
		_locale = locale
		setLocale(locale)
	},

	async switchTo(raw: string) {
		const locale = toSafeLocale(raw)
		_locale = locale
		setLocale(locale)
		await apiFetch('/auth/me', {
			method: 'PUT',
			body: JSON.stringify({ locale }),
		})
	},
}
