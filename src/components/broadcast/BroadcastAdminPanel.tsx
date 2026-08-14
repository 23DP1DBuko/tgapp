import { useEffect, useState } from 'react'

import {
  listBroadcasts,
  sendBroadcast,
} from '../../lib/firebase/broadcasts'
import { AdminFeedbackBanner } from '../ui/AdminFeedbackBanner'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import type { Broadcast } from '../../types/broadcast'

type BroadcastAdminPanelProps = {
  initData: string
}

type ViewMode = 'compose' | 'history'

export function BroadcastAdminPanel({ initData }: BroadcastAdminPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('compose')
  const [composeText, setComposeText] = useState('')
  const [items, setItems] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)
  const [confirmSend, setConfirmSend] = useState(false)
  async function loadHistory() {
    try {
      setLoading(true)
      setError(null)
      const data = await listBroadcasts(20)
      setItems(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load broadcasts.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (viewMode === 'history') {
      void loadHistory()
    }
  }, [viewMode])

  async function handleSend() {
    const trimmed = composeText.trim()
    if (!trimmed) {
      setFeedback({ tone: 'error', message: 'Broadcast text cannot be empty.' })
      return
    }

    setSending(true)
    setFeedback(null)
    setError(null)

    try {
      await sendBroadcast(initData, trimmed)
      triggerHapticFeedback('medium')
      setFeedback({
        tone: 'success',
        message: 'Broadcast sent to all subscribers.',
      })
      setComposeText('')
      setConfirmSend(false)
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to send broadcast.',
      })
    } finally {
      setSending(false)
    }
  }

  function formatTimestamp(createdAt: string | null): string {
    if (!createdAt) return 'Unknown'
    try {
      return new Date(createdAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return 'Unknown'
    }
  }

  const charCount = composeText.trim().length
  const canSend = charCount > 0 && !sending

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.94),rgba(18,10,22,0.96))] shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
      {/* ── View Toggle ── */}
      <div className="flex border-b border-white/10">
        <button
          type="button"
          onClick={() => {
            setViewMode('compose')
            setFeedback(null)
            setError(null)
          }}
          className={`flex-1 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition-colors ${
            viewMode === 'compose'
              ? 'bg-white/6 text-[var(--shop-cream)]'
              : 'text-[var(--shop-muted)]'
          }`}
        >
          Compose New
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode('history')
            setFeedback(null)
            setError(null)
          }}
          className={`flex-1 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition-colors ${
            viewMode === 'history'
              ? 'bg-white/6 text-[var(--shop-cream)]'
              : 'text-[var(--shop-muted)]'
          }`}
        >
          History Log
        </button>
      </div>

      {/* ── Feedback Banner ── */}
      {feedback ? (
        <AdminFeedbackBanner
          tone={feedback.tone}
          message={feedback.message}
          className="mx-5 mt-4"
        />
      ) : null}

      {/* ── Compose View ── */}
      {viewMode === 'compose' ? (
        <div className="p-5">
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">
              Broadcast Message
            </span>
            <textarea
              value={composeText}
              onChange={(event) => {
                setComposeText(event.target.value)
                setConfirmSend(false)
              }}
              placeholder="Write your broadcast message to all Telegram subscribers..."
              className="min-h-32 w-full resize-y rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm leading-6 text-[var(--shop-cream)] outline-none transition placeholder:text-[var(--shop-muted)]/70 focus:border-[var(--shop-purple)]"
              maxLength={2000}
            />
          </label>

          <p className="mt-2 text-right text-[11px] text-[var(--shop-muted)]/60">
            {charCount} / 2000
          </p>

          <button
            type="button"
            onClick={() => setConfirmSend(true)}
            disabled={!canSend}
            className="mt-4 w-full rounded-2xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-[0_8px_24px_rgba(139,61,255,0.3)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {sending ? 'SENDING...' : 'SEND TO ALL SUBSCRIBERS'}
          </button>

          {confirmSend ? (
            <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                Send this message to every subscriber? This cannot be undone.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmSend(false)}
                  disabled={sending}
                  className="flex-1 rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] transition-colors hover:bg-white/14 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 rounded-xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {sending ? 'SENDING...' : 'Confirm Send'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── History Log View ── */}
      {viewMode === 'history' ? (
        <div className="p-5">
          {error ? (
            <div className="rounded-2xl bg-[var(--shop-red)]/18 px-4 py-3 text-sm text-[var(--shop-cream)]">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
              Loading broadcast history...
            </div>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <div className="rounded-2xl bg-white/8 px-4 py-8 text-center text-sm text-[var(--shop-muted)]">
              No broadcasts sent yet.
            </div>
          ) : null}

          {!loading && !error && items.length > 0 ? (
            <div className="space-y-3">
              {items.map((broadcast) => {
                const truncatedText =
                  broadcast.text.length > 100
                    ? `${broadcast.text.slice(0, 100)}...`
                    : broadcast.text

                return (
                  <div
                    key={broadcast.id}
                    className="rounded-2xl border border-white/10 bg-[var(--shop-panel)] px-4 py-3"
                  >
                    {/* Header row: timestamp */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]/70">
                        {formatTimestamp(broadcast.createdAt)}
                      </p>
                    </div>

                    {/* Admin ID tag */}
                    <div className="mt-2">
                      <span className="inline-block rounded-full border border-white/10 bg-white/6 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                        Admin ID: {broadcast.createdBy ?? '—'}
                      </span>
                    </div>

                    {/* Content preview */}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--shop-cream)]">
                      {truncatedText}
                    </p>

                    {/* Delivery metrics */}
                    <div className="mt-3 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
          <g transform="translate(4, 4)">

                          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.5a.75.75 0 011.5 0V8a.75.75 0 01-1.5 0V4.5zM8 10.5a.75.75 0 100 1.5.75.75 0 000-1.5z" />
                        
          </g>
        </svg>
                        {broadcast.sentCount} Sent
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <g transform="translate(4, 4)">

                          <circle cx="8" cy="8" r="6" />
                          <path d="M8 5v3.5" />
                          <path d="M8 11.5v.01" />
                        
          </g>
        </svg>
                        {broadcast.failedCount} Failed
                      </span>
                    </div>

                    {/* Failure reason alert */}
                    {broadcast.failedCount > 0 && broadcast.reason ? (
                      <div className="mt-2 rounded-xl bg-[var(--shop-red)]/14 px-3.5 py-2.5 text-[11px] font-medium leading-5 text-[var(--shop-red)]/90">
                        Reason: {broadcast.reason}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
