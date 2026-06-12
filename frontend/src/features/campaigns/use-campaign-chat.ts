import { useCallback, useEffect, useRef, useState } from 'react'
import { streamGenerate } from '@/lib/api/ai'
import type { AIGenerateRequest } from '@/lib/api/ai'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// localStorage helpers (module-scope pure functions — ported verbatim from Svelte)
// ---------------------------------------------------------------------------

const MAX_PERSISTED = 30

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
    // localStorage unavailable (private mode / quota)
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCampaignChat(tenantId: string, campaignId: string): CampaignChatStore {
  // Lazy initialiser so loadMessages only runs once on mount, not every render
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadMessages(tenantId, campaignId)
  )
  const [isOpen, setIsOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Non-reactive refs — safe to read inside useCallback without stale closure issues
  const controllerRef = useRef<AbortController | null>(null)
  // busyRef mirrors busy for re-entrancy guard (useState value would be stale in closures)
  const busyRef = useRef(false)
  // messagesRef mirrors messages so send() can read current history without capturing stale state
  const messagesRef = useRef(messages)
  messagesRef.current = messages // synced on every render

  // ---------------------------------------------------------------------------
  // Persistence strategy: effect-based persist fires after every committed
  // messages or busy change. It is silent while streaming (busy=true) and
  // triggers after send-finally (busy→false), after abort (busy→false), and
  // after clear. This matches the Svelte persist() call sites exactly.
  // The extra persist-on-mount (busy=false, initial messages) is a harmless
  // idempotent re-write of whatever is already in localStorage.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!busy) {
      saveMessages(tenantId, campaignId, messages)
    }
  }, [messages, busy, tenantId, campaignId])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  const clear = useCallback(() => {
    setMessages([])
    // persist happens via the effect above (busy is false)
  }, [])

  const abort = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    // Clear streaming flag on last message if it is streaming
    setMessages((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      if (!last.streaming) return prev
      const copy = [...prev]
      copy[copy.length - 1] = { ...last, streaming: false }
      return copy
    })
    busyRef.current = false
    setBusy(false)
    // persist happens via the effect (busy→false triggers it)
  }, [])

  const send = useCallback(
    async (req: Omit<AIGenerateRequest, 'messages'>, userText: string) => {
      if (busyRef.current || !userText.trim()) return

      // Build base: current messages + the new user message (no placeholder yet)
      const base: ChatMessage[] = [
        ...messagesRef.current,
        { role: 'user', content: userText.trim() },
      ]

      // Push base + empty assistant placeholder
      setMessages([...base, { role: 'assistant', content: '', streaming: true }])
      busyRef.current = true
      setBusy(true)
      controllerRef.current = new AbortController()

      // History sent to the API: base mapped to AIMessage (excludes the placeholder)
      const history = base.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      try {
        await streamGenerate(
          { ...req, task_type: 'chat', messages: history },
          (chunk) => {
            if (!chunk.done) {
              setMessages((prev) => {
                const copy = [...prev]
                const last = copy.length - 1
                copy[last] = { ...copy[last], content: copy[last].content + chunk.content }
                return copy
              })
            }
          },
          controllerRef.current.signal
        )
      } catch (e: unknown) {
        if ((e as Error)?.name !== 'AbortError') {
          setMessages((prev) => {
            if (prev.length === 0) return prev
            const copy = [...prev]
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              content: '⚠ Error: ' + ((e as Error)?.message ?? 'generation failed'),
            }
            return copy
          })
        }
      } finally {
        // Clear streaming flag on last message
        setMessages((prev) => {
          if (prev.length === 0) return prev
          const copy = [...prev]
          copy[copy.length - 1] = { ...copy[copy.length - 1], streaming: false }
          return copy
        })
        busyRef.current = false
        setBusy(false)
        controllerRef.current = null
        // persist happens via the effect (busy→false triggers it)
      }
    },
    [] // no deps — reads state through refs
  )

  return { messages, isOpen, busy, open, close, toggle, send, abort, clear }
}
