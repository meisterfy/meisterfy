import type { Icon } from 'lucide-svelte'
import type { Snippet, Component } from 'svelte'

export type MenuItem =
	| { type: 'header'; label: string }
	| { type: 'separator' }
	| {
			label: string
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			icon?: typeof Icon | Snippet | Component<any>
			iconProps?: Record<string, unknown>
			href?: string
			onclick?: () => void
			variant?: 'default' | 'danger' | 'indigo'
			active?: boolean
			flag?: string
			children?: MenuItem[]
	  }
