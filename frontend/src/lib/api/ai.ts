import { getToken } from './client'

export interface AIMessage {
	role: 'user' | 'assistant' | 'system'
	content: string
}

export interface AIGenerateRequest {
	tenant_id: string
	messages: AIMessage[]
	system?: string
	task_type?: string
	model?: string
	temperature?: number
	max_tokens?: number
}

export interface AIChunk {
	content: string
	done: boolean
}

export type ChunkCallback = (chunk: AIChunk) => void

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export async function streamGenerate(req: AIGenerateRequest, onChunk: ChunkCallback): Promise<void> {
	const token = getToken()
	const res = await fetch(`${BASE_URL}/ai/generate`, {
		method: 'POST',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'text/event-stream',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(req),
	})

	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: res.statusText }))
		throw new Error(body.error ?? 'AI generate failed')
	}

	const reader = res.body!.getReader()
	const decoder = new TextDecoder()
	let buffer = ''

	while (true) {
		const { done, value } = await reader.read()
		if (done) break

		buffer += decoder.decode(value, { stream: true })
		const parts = buffer.split('\n\n')
		buffer = parts.pop() ?? ''

		for (const part of parts) {
			const line = part.trim()
			if (!line.startsWith('data:')) continue
			const raw = line.slice(5).trim()
			if (raw === '[DONE]') return
			try {
				const chunk = JSON.parse(raw) as AIChunk
				onChunk(chunk)
			} catch {
				// malformed chunk — skip
			}
		}
	}
}
