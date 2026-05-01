import { describe, it, expect, vi, afterEach } from 'vitest'
import { streamGenerate } from './ai'

function makeSSEStream(lines: string[]): ReadableStream<Uint8Array> {
	const body = lines.join('')
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(body))
			controller.close()
		},
	})
}

describe('streamGenerate', () => {
	afterEach(() => { vi.restoreAllMocks() })

	it('delivers text chunks from SSE stream', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			body: makeSSEStream([
				'data: {"content":"Hello","done":false}\n\n',
				'data: {"content":", world","done":false}\n\n',
				'data: [DONE]\n\n',
			]),
		}))

		const collected: string[] = []
		await streamGenerate(
			{ tenant_id: 't1', messages: [{ role: 'user', content: 'hi' }] },
			chunk => collected.push(chunk.content),
		)

		expect(collected).toEqual(['Hello', ', world'])
	})

	it('sends correct headers and payload', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			body: makeSSEStream(['data: [DONE]\n\n']),
		})
		vi.stubGlobal('fetch', mockFetch)

		await streamGenerate(
			{ tenant_id: 't1', messages: [{ role: 'user', content: 'hi' }], system: 'be brief' },
			() => {},
		)

		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
		expect(init.method).toBe('POST')
		expect((init.headers as Record<string, string>)['Accept']).toBe('text/event-stream')
		const body = JSON.parse(init.body as string)
		expect(body.tenant_id).toBe('t1')
		expect(body.system).toBe('be brief')
	})

	it('throws on non-ok response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false,
			status: 503,
			json: async () => ({ error: 'no provider available' }),
		}))

		await expect(
			streamGenerate({ tenant_id: 't1', messages: [{ role: 'user', content: 'hi' }] }, () => {}),
		).rejects.toThrow('no provider available')
	})
})
