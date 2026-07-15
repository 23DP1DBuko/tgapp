import { useCallback, useEffect, useState } from 'react'

import { listActivePolls, castVote } from '../../lib/firebase/polls'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import { PageHeader } from '../ui/PageHeader'
import type { Poll } from '../../types/poll'

type BuyerPollPanelProps = {
  initData: string
  hasTelegramAccess: boolean
  onBack: () => void
}

export function BuyerPollPanel({ initData, hasTelegramAccess, onBack }: BuyerPollPanelProps) {
  const [polls, setPolls] = useState<Poll[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submittingVoteId, setSubmittingVoteId] = useState<string | null>(null)

  // Track which option the user selected (before confirming)
  const [selectedVotes, setSelectedVotes] = useState<Record<string, number>>({})
  // Track confirmed votes
  const [confirmedVotes, setConfirmedVotes] = useState<Record<string, number>>({})

  // ── Load active polls ──

  const loadPolls = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listActivePolls(10)
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

  // ── Select / vote ──

  function handleSelectOption(pollId: string, optionIndex: number) {
    if (!hasTelegramAccess) return
    setSelectedVotes((prev) => ({
      ...prev,
      [pollId]: optionIndex,
    }))
  }

  async function handleConfirmVote(pollId: string, optionIndex: number) {
    if (!hasTelegramAccess) return
    triggerHapticFeedback('light')

    setSubmittingVoteId(pollId)
    setError(null)

    try {
      await castVote(initData, pollId, optionIndex)
      setConfirmedVotes((prev) => ({
        ...prev,
        [pollId]: optionIndex,
      }))
      // Refresh poll data to show updated vote counts
      await loadPolls()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote.')
    } finally {
      setSubmittingVoteId(null)
    }
  }

  // ── Compute total votes for display ──

  function getTotalVotes(poll: Poll): number {
    return poll.options.reduce((sum, o) => sum + o.votes, 0)
  }

  // ── Render ──

  return (
    <div className="space-y-4">
      {onBack && (
        <PageHeader label="Back" onClick={onBack} />
      )}

      <article className="rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
          Community Polls
        </p>
        <p className="mt-1 text-[11px] leading-5 text-[var(--shop-muted)]">
          Vote on what we should drop next. One vote per poll.
        </p>
      </article>

      {error && (
        <article className="rounded-[24px] border border-[var(--shop-red)]/20 bg-[var(--shop-red)]/10 p-4">
          <p className="text-xs text-[var(--shop-red)]">{error}</p>
        </article>
      )}

      {isLoading ? (
        <article className="rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5">
          <p className="text-sm text-[var(--shop-muted)]">Loading polls...</p>
        </article>
      ) : polls.length === 0 ? (
        <article className="rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5">
          <p className="text-sm text-[var(--shop-muted)]">
            No active polls right now. Check back later!
          </p>
        </article>
      ) : (
        polls.map((poll) => {
          const selectedIndex = selectedVotes[poll.id]
          const confirmedIndex = confirmedVotes[poll.id]
          const hasVoted = confirmedIndex !== undefined
          const totalVotes = getTotalVotes(poll)
          const isSubmitting = submittingVoteId === poll.id

          return (
            <article
              key={poll.id}
              className="rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            >
              <p className="text-sm font-bold text-[var(--shop-cream)]">{poll.title}</p>
              {poll.description && (
                <p className="mt-1 text-xs leading-5 text-[var(--shop-muted)]">
                  {poll.description}
                </p>
              )}

              <div className="mt-4 space-y-2.5">
                {poll.options.map((option, index) => {
                  const isSelected = selectedIndex === index
                  const isConfirmed = confirmedIndex === index
                  const votePercent = totalVotes > 0
                    ? Math.round((option.votes / totalVotes) * 100)
                    : 0

                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={!hasTelegramAccess || hasVoted || isSubmitting}
                      onClick={() => handleSelectOption(poll.id, index)}
                      className={`relative w-full rounded-[16px] border p-3.5 text-left transition-all duration-200 ${
                        isConfirmed
                          ? 'border-[var(--shop-purple)]/40 bg-[var(--shop-purple)]/10'
                          : isSelected
                            ? 'border-[var(--shop-purple)] bg-[var(--shop-purple)]/8'
                            : hasVoted
                              ? 'border-white/5 bg-white/3 opacity-60'
                              : 'border-white/8 bg-white/4 hover:border-white/20'
                      } disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span
                            className={`text-sm ${
                              isConfirmed
                                ? 'text-[var(--shop-cream)] font-semibold'
                                : isSelected
                                  ? 'text-[var(--shop-cream)]'
                                  : 'text-[var(--shop-muted)]'
                            }`}
                          >
                            {option.label}
                          </span>
                        </div>
                        {hasVoted && (
                          <span className="shrink-0 text-xs text-[var(--shop-muted)]">
                            {option.votes} ({votePercent}%)
                          </span>
                        )}
                        {isSelected && !hasVoted && (
                          <span className="h-5 w-5 shrink-0 rounded-full border-2 border-[var(--shop-purple)] flex items-center justify-center">
                            <span className="h-2.5 w-2.5 rounded-full bg-[var(--shop-purple)]" />
                          </span>
                        )}
                      </div>

                      {/* Progress bar (only show after voting) */}
                      {hasVoted && (
                        <div className="mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isConfirmed
                                ? 'bg-gradient-to-r from-[var(--shop-purple)] to-[var(--shop-red)]'
                                : 'bg-white/15'
                            }`}
                            style={{ width: `${votePercent}%` }}
                          />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Confirm button (only if selected but not confirmed) */}
              {selectedIndex !== undefined && !hasVoted && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleConfirmVote(poll.id, selectedIndex)}
                  className="mt-4 w-full rounded-[22px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-40"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm Vote'}
                </button>
              )}

              {hasVoted && (
                <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                  You voted · {totalVotes} total {totalVotes === 1 ? 'vote' : 'votes'}
                </p>
              )}
            </article>
          )
        })
      )}
    </div>
  )
}
