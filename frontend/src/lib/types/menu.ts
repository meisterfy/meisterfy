import type { Icon } from 'lucide-svelte'
import type { Snippet } from 'svelte'

export type MenuItem =
	| { type: 'header'; label: string }
	| { type: 'separator' }
	| {
			label: string
			icon?: typeof Icon | Snippet
			iconProps?: Record<string, any>
			href?: string
			onclick?: () => void
			variant?: 'default' | 'danger' | 'indigo'
			active?: boolean
			flag?: string
			children?: MenuItem[]
	  }
