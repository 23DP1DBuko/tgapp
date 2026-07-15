import { useCallback, useEffect, useState } from 'react'

import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import { listPolls, createPoll, updatePoll, deletePoll, getPollResults } from '../../lib/firebase/polls'
import type { Poll, PollInput } from '../../types/poll'

type PollAdminPanelProps = {
  initData: string
}

export function PollAdminPanel({ initData }: PollAdminPanelProps) {
  const [polls, setPolls] = useState<Poll[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [isActive, setIsActive] = useState(true)

  // Results view
  const [viewingResults, setViewingResults] = useState<{
    pollId: string
    title: string
    totalVotes: number
    results: { label: string; votes: number; percentage: number }[]
  } | null>(null)

  // ── Load polls ──

  const loadPolls = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listPolls(20)
      setPolls(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load polls.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPolls()
  }, [loadPolls])

  // ── Form helpers ──

  function resetForm() {
    setTitle('')
    setDescription('')
    setOptions(['', ''])
    setIsActive(true)
    setEditingPoll(null)
  }

  function startEdit(poll: Poll) {
    setTitle(poll.title)
    setDescription(poll.description)
    setOptions(poll.options.map((o) => o.label))
    setIsActive(poll.isActive)
    setEditingPoll(poll)
  }

  function handleOptionChange(index: number, value: string) {
    setOptions((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function addOption() {
    if (options.length >= 4) return
    setOptions((prev) => [...prev, ''])
  }

  function removeOption(index: number) {
    if (options.length <= 2) return
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Save poll ──

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    triggerHapticFeedback('light')

    const trimmedTitle = title.trim()
    const trimmedDesc = description.trim()
    const trimmedOptions = options
      .map((o) => o.trim())
      .filter(Boolean)

    if (!trimmedTitle) {
      setError('Title is required.')
      return
    }

    if (trimmedOptions.length < 2) {
      setError('At least 2 options are required.')
      return
    }

    if (trimmedOptions.some((o) => o.length > 80)) {
      setError('Each option label must be 80 characters or less.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const pollOptions = trimmedOptions.map((label) => ({
        label,
        imageUrl: '',
      }))

      const input: PollInput = {
        title: trimmedTitle,
        description: trimmedDesc,
        options: pollOptions,
        isActive,
      }

      if (editingPoll) {
        await updatePoll(initData, editingPoll.id, input)
      } else {
        await createPoll(initData, input)
      }

      resetForm()
      await loadPolls()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save poll.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Delete poll ──

  async function handleDelete(pollId: string) {
    triggerHapticFeedback('light')
    setError(null)
    try {
      await deletePoll(initData, pollId)
      await loadPolls()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete poll.')
    }
  }

  // ── View results ──

  async function handleViewResults(poll: Poll) {
    triggerHapticFeedback('light')
    setError(null)
    try {
      const results = await getPollResults(initData, poll.id)
      setViewingResults(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results.')
    }
  }

  // ── Render ──

  return (
    <div className="space-y-4">
      <article className="rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
          {editingPoll ? 'Edit Poll' : 'Create Poll'}
        </p>

        {error && (
          <p className="mt-3 text-xs text-[var(--shop-red)]">{error}</p>
        )}

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              className="w-full rounded-[14px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)] focus:border-[var(--shop-purple)]"
              placeholder="Which design should we drop next?"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-[14px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)] focus:border-[var(--shop-purple)] resize-none"
              placeholder="Tell buyers what they're voting on..."
            />
          </div>

          {/* Options */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Options ({options.length}/4)
            </label>
            <div className="space-y-2">
              {options.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    maxLength={80}
                    required
                    className="flex-1 rounded-[14px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)] focus:border-[var(--shop-purple)]"
                    placeholder={`Option ${index + 1}`}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="rounded-full p-2 text-[var(--shop-red)] hover:bg-white/8"
                      aria-label="Remove option"
                    >
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <g transform="translate(2, 2)">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </g>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 4 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-2 rounded-[12px] border border-dashed border-white/15 px-3 py-2 text-xs font-semibold text-[var(--shop-muted)] hover:border-white/30"
              >
                + Add Option
              </button>
            )}
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-[var(--shop-purple)]"
            />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shop-cream)]">
              Active (visible to buyers)
            </span>
          </label>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-[22px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-40"
            >
              {isSaving ? 'Saving...' : editingPoll ? 'Update Poll' : 'Create Poll'}
            </button>
            {editingPoll && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </article>

      {/* ── Polls List ── */}
      <article className="rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
          All Polls
        </p>

        {isLoading ? (
          <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">Loading polls...</p>
        ) : polls.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">No polls yet. Create your first one above.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {polls.map((poll) => (
              <div
                key={poll.id}
                className="rounded-[16px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--shop-cream)] truncate">
                      {poll.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--shop-muted)]">
                      {poll.options.length} options · {poll.totalVotes} votes
                    </p>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${
                        poll.isActive
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-white/8 text-[var(--shop-muted)]'
                      }`}
                    >
                      {poll.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleViewResults(poll)}
                      className="rounded-[12px] border border-white/10 bg-white/6 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-cream)] hover:bg-white/10"
                      aria-label="View results"
                    >
                      Results
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(poll)}
                      className="rounded-[12px] border border-white/10 bg-white/6 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-cream)] hover:bg-white/10"
                      aria-label="Edit poll"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(poll.id)}
                      className="rounded-[12px] border border-[var(--shop-red)]/30 bg-[var(--shop-red)]/10 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-red)] hover:bg-[var(--shop-red)]/20"
                      aria-label="Delete poll"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      {/* ── Results Modal ── */}
      {viewingResults && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-[28px] border border-white/10 bg-[var(--shop-bg)] p-5 shadow-[0_-12px_40px_rgba(0,0,0,0.4)]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
                {viewingResults.title}
              </p>
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback('light')
                  setViewingResults(null)
                }}
                className="rounded-full p-1.5 text-[var(--shop-muted)] hover:bg-white/8"
                aria-label="Close results"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <g transform="translate(2, 2)">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </g>
                </svg>
              </button>
            </div>

            <p className="text-xs text-[var(--shop-muted)] mb-4">
              Total votes: {viewingResults.totalVotes}
            </p>

            <div className="space-y-3">
              {viewingResults.results.map((option, index) => (
                <div key={index}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--shop-cream)]">{option.label}</span>
                    <span className="text-[var(--shop-muted)]">
                      {option.votes} ({option.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--shop-purple)] to-[var(--shop-red)] transition-all duration-500"
                      style={{ width: `${option.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
