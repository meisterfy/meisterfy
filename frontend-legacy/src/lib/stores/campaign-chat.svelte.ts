import { streamGenerate } from '$lib/api/ai'
import type { AIGenerateRequest } from '$lib/api/ai'

const MAX_PERSISTED = 30

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

function storageKey(tenantId: string, campaignId: string) {
	return `chat:${tenantId}:${campaignId}`
}

function loadMessages(tenantId: string, campaignId: string): ChatMessage[] {
	try {
		const raw = localStorage.getItem(storageKey(tenantId, campaignId))
		return raw ? (JSON.parse(raw) as ChatMessage[]) : []
	} catch {
		return []
	}
}

function saveMessages(tenantId: string, campaignId: string, msgs: ChatMessage[]) {
	try {
		const persisted = msgs
			.filter((m) => !m.streaming)
			.slice(-MAX_PERSISTED)
			.map(({ role, content }) => ({ role, content }))
		localStorage.setItem(storageKey(tenantId, campaignId), JSON.stringify(persisted))
	} catch {
		// localStorage unavailable (private mode quota)
	}
}

export function createCampaignChat(tenantId: string, campaignId: string): CampaignChatStore {
	let messages = $state<ChatMessage[]>(loadMessages(tenantId, campaignId))
	let isOpen = $state(false)
	let busy = $state(false)
	let controller: AbortController | null = null

	function persist() {
		saveMessages(tenantId, campaignId, messages)
	}

	return {
		get messages() {
			return messages
		},
		get isOpen() {
			return isOpen
		},
		get busy() {
			return busy
		},

		open() {
			isOpen = true
		},
		close() {
			isOpen = false
		},
		toggle() {
			isOpen = !isOpen
		},
		clear() {
			messages = []
			persist()
		},

		abort() {
			controller?.abort()
			controller = null
			if (messages.length > 0 && messages[messages.length - 1].streaming) {
				messages[messages.length - 1].streaming = false
			}
			busy = false
			persist()
		},

		async send(req, userText) {
			if (busy || !userText.trim()) return
			messages.push({ role: 'user', content: userText.trim() })
			messages.push({ role: 'assistant', content: '', streaming: true })
			busy = true
			controller = new AbortController()

			// Build history: exclude the empty assistant placeholder we just pushed
			const history: typeof messages = messages.slice(0, -1).map((m) => ({
				role: m.role,
				content: m.content
			}))

			try {
				await streamGenerate(
					{
						...req,
						task_type: 'chat',
						messages: history.map((m) => ({
							role: m.role as 'user' | 'assistant',
							content: m.content
						}))
					},
					(chunk) => {
						if (!chunk.done) messages[messages.length - 1].content += chunk.content
					},
					controller.signal
				)
			} catch (e: unknown) {
				if ((e as Error)?.name !== 'AbortError') {
					messages[messages.length - 1].content =
						'⚠ Error: ' + ((e as Error)?.message ?? 'generation failed')
				}
			} finally {
				if (messages.length > 0) messages[messages.length - 1].streaming = false
				busy = false
				controller = null
				persist()
			}
		}
	}
}
