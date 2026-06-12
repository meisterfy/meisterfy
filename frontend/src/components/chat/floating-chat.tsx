import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Send, Square, Trash2, MessageSquare } from 'lucide-react'
import type { CampaignChatStore } from '@/features/campaigns/use-campaign-chat'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FloatingChatProps {
  chat: CampaignChatStore
  systemPrompt: string
  tenantId: string
  // campaignId is part of the caller contract (used by C9) but not needed here
  campaignId: string
}

// ---------------------------------------------------------------------------
// Markdown renderer — port of Svelte renderMd(), 5 regex replacements verbatim
// ---------------------------------------------------------------------------

function renderMd(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h3 class="text-sm font-bold mt-3 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-3 list-disc">$1</li>')
    .replace(/\n\n/g, '<br class="mb-1">')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FloatingChat({ chat, systemPrompt, tenantId }: FloatingChatProps) {
  const { t } = useTranslation('globals')
  const [input, setInput] = useState('')
  const viewport = useRef<HTMLDivElement>(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (chat.messages.length && viewport.current) {
      viewport.current.scrollTop = viewport.current.scrollHeight
    }
  }, [chat.messages])

  function send() {
    const text = input.trim()
    if (!text || chat.busy) return
    setInput('')
    chat.send({ tenant_id: tenantId, system: systemPrompt }, text)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const assistantCount = chat.messages.filter((m) => m.role === 'assistant').length

  return (
    <>
      {/* Floating button */}
      {!chat.isOpen && (
        <button
          onClick={() => chat.open()}
          className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl"
          aria-label={t('chat_open_aria')}
        >
          <MessageSquare className="h-6 w-6" />
          {chat.messages.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold">
              {assistantCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {chat.isOpen && (
        <div
          className="fixed right-6 bottom-6 z-50 flex w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          style={{ height: 'min(600px, calc(100vh - 6rem))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
                {/* Inline sparkle SVG — matches Svelte source exactly */}
                <svg
                  className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('chat_title')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {chat.messages.length > 0 && (
                <button
                  onClick={() => chat.clear()}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                  title={t('chat_clear_aria')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => chat.close()}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={viewport} className="flex-1 space-y-3 overflow-y-auto p-4">
            {chat.messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400 dark:text-slate-600">
                <MessageSquare className="mb-2 h-8 w-8" />
                <p className="text-sm">{t('chat_hint_1')}</p>
                <p className="mt-1 text-xs">{t('chat_hint_2')}</p>
              </div>
            ) : (
              chat.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'rounded-br-sm bg-indigo-600 text-white'
                        : 'rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <>
                        {msg.streaming && !msg.content ? (
                          <div className="flex items-center gap-1 py-0.5">
                            <span
                              className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                              style={{ animationDelay: '0ms' }}
                            />
                            <span
                              className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                              style={{ animationDelay: '150ms' }}
                            />
                            <span
                              className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                              style={{ animationDelay: '300ms' }}
                            />
                          </div>
                        ) : (
                          <>
                            {/* eslint-disable-next-line react/no-danger */}
                            <span dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }} />
                            {msg.streaming && (
                              <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-indigo-500 align-text-bottom" />
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 p-3 dark:border-slate-800">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('chat_placeholder')}
                rows={1}
                disabled={chat.busy}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                style={{ maxHeight: '120px', overflowY: 'auto', fieldSizing: 'content' } as React.CSSProperties}
              />
              {chat.busy ? (
                <button
                  onClick={() => chat.abort()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                  title={t('chat_stop')}
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
