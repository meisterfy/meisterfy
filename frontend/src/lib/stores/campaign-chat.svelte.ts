import { streamGenerate } from '$lib/api/ai'
import type { AIGenerateRequest } from '$lib/api/ai'

export interface ChatMessage {
	role: 'user' | 'assistant'
	content: string
	streaming?: boolean
}

export interface CampaignChatStore {
	messages: ChatMessage[]
	isOpen: boolean
	busy: boolean
	open(): void
	close(): void
	toggle(): void
	send(req: Omit<AIGenerateRequest, 'messages'>, userText: string): Promise<void>
	abort(): void
	clear(): void
}

export function createCampaignChat(): CampaignChatStore {
	let messages  = $state<ChatMessage[]>([])
	let isOpen    = $state(false)
	let busy      = $state(false)
	let controller: AbortController | null = null

	return {
		get messages() { return messages },
		get isOpen()   { return isOpen },
		get busy()     { return busy },

		open()   { isOpen = true },
		close()  { isOpen = false },
		toggle() { isOpen = !isOpen },
		clear()  { messages = [] },

		abort() {
			controller?.abort()
			controller = null
			if (messages.length > 0 && messages[messages.length - 1].streaming) {
				messages[messages.length - 1].streaming = false
			}
			busy = false
		},

		async send(req, userText) {
			if (busy || !userText.trim()) return
			messages.push({ role: 'user', content: userText.trim() })
			messages.push({ role: 'assistant', content: '', streaming: true })
			busy = true
			controller = new AbortController()

			// Build history: exclude the empty assistant placeholder we just pushed
			const history: typeof messages = messages.slice(0, -1).map(m => ({
				role: m.role,
				content: m.content
			}))

			try {
				await streamGenerate(
					{
						...req,
						task_type: 'chat',
						messages: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
					},
					(chunk) => {
						if (!chunk.done) messages[messages.length - 1].content += chunk.content
					},
					controller.signal
				)
			} catch (e: unknown) {
				if ((e as Error)?.name !== 'AbortError') {
					messages[messages.length - 1].content = '⚠ Error: ' + ((e as Error)?.message ?? 'generation failed')
				}
			} finally {
				if (messages.length > 0) messages[messages.length - 1].streaming = false
				busy = false
				controller = null
			}
		}
	}
}
