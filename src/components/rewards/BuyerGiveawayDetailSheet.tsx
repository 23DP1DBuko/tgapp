import { useCallback, useEffect, useMemo, useState } from 'react'

import { motion, AnimatePresence } from 'motion/react'

import {
  joinGiveaway,
  completeGiveawayTask,
  getGiveawayEntries,
  getMyGiveawayEntry,
} from '../../lib/firebase/giveaways'
import { triggerHapticFeedback, triggerHapticNotification } from '../../lib/telegram/webApp'
import { BottomSheet } from '../ui/BottomSheet'
import type { Giveaway, GiveawayEntry, EntryTask } from '../../types/rewards'

type BuyerGiveawayDetailSheetProps = {
  isOpen: boolean
  giveaway: Giveaway | null
  initData: string
  onClose: () => void
  onEntryChanged?: () => void
}

const GIVEAWAY_DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80'

type CountdownUnit = {
  label: string
  value: number
}

function computeCountdown(endsAt: string | null): CountdownUnit[] | null {
  if (!endsAt) return null
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return null

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const seconds = Math.floor((diff / 1000) % 60)

  return [
    { label: 'Days', value: days },
    { label: 'Hours', value: hours },
    { label: 'Mins', value: minutes },
    { label: 'Secs', value: seconds },
  ]
}

export function BuyerGiveawayDetailSheet({
  isOpen,
  giveaway,
  initData,
  onClose,
  onEntryChanged,
}: BuyerGiveawayDetailSheetProps) {
  // ── Local state ──
  const [myEntry, setMyEntry] = useState<GiveawayEntry | null>(null)
  const [entries, setEntries] = useState<GiveawayEntry[]>([])
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [isJoining, setIsJoining] = useState(false)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [joinResultText, setJoinResultText] = useState<string | null>(null)

  // ── Tick countdown every second ──
  useEffect(() => {
    if (!isOpen) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [isOpen])

  // ── Clear join result text after 3s ──
  useEffect(() => {
    if (!joinResultText) return
    const timer = setTimeout(() => setJoinResultText(null), 3000)
    return () => clearTimeout(timer)
  }, [joinResultText])

  // ── Fetch entries when sheet opens or entry changes ──
  // Uses a two-step approach:
  // 1. Fast targeted query (by userId) to get the user's entry immediately
  // 2. Full entries fetch for leaderboard (less frequent)
  useEffect(() => {
    if (!isOpen || !giveaway || !initData) return
    const g = giveaway

    let cancelled = false
    async function load() {
      // Step 1: Fast lightweight check — only the current user's entry
      try {
        const result = await getMyGiveawayEntry(initData, g.id)
        if (!cancelled) {
          setMyEntry(result.entry)
        }
      } catch {
        // Will fall through to full entries fetch
      }

      // Step 2: Full entries fetch for leaderboard data
      try {
        const result = await getGiveawayEntries(initData, g.id)
        if (cancelled) return
        setEntries(result.entries)
        setTotalParticipants(result.totalParticipants)
      } catch {
        // Silently fail
      }
    }
    void load()
    return () => { cancelled = true }
  }, [isOpen, giveaway?.id, initData])

  // ── Sort entries by tickets descending for leaderboard ──
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.totalTickets - a.totalTickets),
    [entries],
  )

  const totalTicketsPool = useMemo(
    () => sortedEntries.reduce((sum, e) => sum + e.totalTickets, 0),
    [sortedEntries],
  )

  const myTickets = myEntry?.totalTickets ?? 0
  const myChancePct = totalTicketsPool > 0
    ? ((myTickets / totalTicketsPool) * 100)
    : 0

  const myRank = useMemo(() => {
    const idx = sortedEntries.findIndex(
      (e) => e.telegramUserId === myEntry?.telegramUserId,
    )
    return idx >= 0 ? idx + 1 : null
  }, [sortedEntries, myEntry?.telegramUserId])

  const countdown = useMemo(
    () => computeCountdown(giveaway?.endAt ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [giveaway?.endAt, now],
  )

  const hasEnded = giveaway?.status === 'finished' || giveaway?.status === 'announced' || (!!giveaway?.endAt && !countdown)
  const sortedPrizes = useMemo(
    () => (giveaway?.prizes ?? []).sort((a, b) => a.place - b.place),
    [giveaway?.prizes],
  )

  // ── Join giveaway ──
  const handleJoin = useCallback(async () => {
    if (!giveaway || !initData || isJoining) return
    setIsJoining(true)
    try {
      const result = await joinGiveaway(initData, giveaway.id)
      if (result.joined) {
        triggerHapticNotification('success')
        setJoinResultText(`Joined! You have ${result.totalTickets} ticket${result.totalTickets !== 1 ? 's' : ''}.`)
        // Refresh entries
        const refreshed = await getGiveawayEntries(initData, giveaway.id)
        setMyEntry(refreshed.myEntry)
        setEntries(refreshed.entries)
        setTotalParticipants(refreshed.totalParticipants)
        onEntryChanged?.()
      } else {
        setJoinResultText(result.reason === 'already_entered' ? 'Already entered!' : `Could not join: ${result.reason}`)
      }
    } catch {
      setJoinResultText('Failed to join giveaway.')
    } finally {
      setIsJoining(false)
    }
  }, [giveaway, initData, isJoining, onEntryChanged])

  // ── Complete a task ──
  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      if (!giveaway || !initData || completingTaskId !== null) return
      if (isTaskCompleted(taskId)) return
      setCompletingTaskId(taskId)
      try {
        const result = await completeGiveawayTask(initData, giveaway.id, taskId)
        if (result.completed) {
          triggerHapticFeedback('medium')
          setJoinResultText(`+${result.taskTicketsGranted} tickets earned!`)
          // Refresh entries
          const refreshed = await getGiveawayEntries(initData, giveaway.id)
          setMyEntry(refreshed.myEntry)
          setEntries(refreshed.entries)
          setTotalParticipants(refreshed.totalParticipants)
          onEntryChanged?.()
        } else {
          setJoinResultText(`Task not completed: ${result.reason}`)
        }
      } catch {
        setJoinResultText('Failed to complete task.')
      } finally {
        setCompletingTaskId(null)
      }
    },
    [giveaway, initData, completingTaskId, onEntryChanged],
  )

  const isTaskCompleted = useCallback(
    (taskId: string) => myEntry?.completedTaskIds.includes(taskId) ?? false,
    [myEntry],
  )

  const isEntered = myEntry !== null
  const hasAnyWinner = (giveaway?.winners?.length ?? 0) > 0

  // ── Guard: null giveaway hides the sheet ──
  if (!giveaway) return null

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeightPct={88}>
      <div className="space-y-5 pb-10">
        {/* ── HEADER: Title + Status ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
              {giveaway.title || 'Giveaway'}
            </h2>
            {giveaway.description && (
              <p className="mt-1 text-sm leading-6 text-[var(--shop-muted)]">
                {giveaway.description}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
              hasEnded
                ? 'bg-white/8 text-[var(--shop-muted)]'
                : 'bg-emerald-300/15 text-emerald-100'
            }`}
          >
            {hasEnded ? 'Ended' : 'Live'}
          </span>
        </div>

        {/* ── COUNTDOWN ── */}
        {countdown ? (
          <div className="grid grid-cols-4 gap-2">
            {countdown.map((unit) => (
              <div
                key={unit.label}
                className="rounded-xl border border-white/10 bg-black/20 px-2 py-3 text-center"
              >
                <p className="text-xl font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
                  {String(unit.value).padStart(2, '0')}
                </p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                  {unit.label}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              {hasAnyWinner ? 'Winners announced' : 'Giveaway ended'}
            </p>
          </div>
        )}

        {/* ── GIVEAWAY IMAGE ── */}
        {giveaway.imageUrl && (
          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-black/20">
            <img
              src={giveaway.imageUrl}
              alt={giveaway.title || 'Giveaway'}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        )}

        {/* ── PRIZES ── */}
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            Prizes ({sortedPrizes.length})
          </p>
          {sortedPrizes.length === 1 ? (
            <div className="overflow-hidden rounded-[20px] border border-white/10 bg-black/20">
              <img
                src={sortedPrizes[0].productImage || GIVEAWAY_DEFAULT_IMAGE}
                alt={sortedPrizes[0].productName || 'Prize'}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-semibold text-[var(--shop-cream)]">
                  {sortedPrizes[0].productName || 'Mystery Prize'}
                </p>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-400">
                  1st Place
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedPrizes.map((prize) => {
                const placeLabel =
                  prize.place === 1 ? '1st' : prize.place === 2 ? '2nd' : prize.place === 3 ? '3rd' : `${prize.place}th`
                return (
                  <div
                    key={prize.place}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 p-3"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/20">
                      <img
                        src={prize.productImage || GIVEAWAY_DEFAULT_IMAGE}
                        alt={prize.productName || 'Prize'}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">
                        {prize.productName || 'Mystery Prize'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-400">
                      {placeLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── YOUR TICKETS / CHANCE ── */}
        {isEntered && (
          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.1),rgba(255,77,90,0.06))] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
                  Your Tickets
                </p>
                <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
                  {myTickets}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
                  Win Chance
                </p>
                <p className="mt-1 text-lg font-bold tracking-[-0.03em] text-emerald-300">
                  {myChancePct < 0.01 && myTickets > 0
                    ? '<0.01%'
                    : `${myChancePct.toFixed(1)}%`}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            {totalTicketsPool > 0 && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--shop-purple),var(--shop-red))]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(myChancePct * 5, 100)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
              <span>{totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}</span>
              {myRank !== null && <span>Rank #{myRank}</span>}
            </div>
          </div>
        )}

        {/* ── TASKS: Boost Your Chances ── */}
        {giveaway.entryTasks.length > 0 && !hasEnded && (
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
              Boost Your Chances
            </p>
            <div className="space-y-2">
              {giveaway.entryTasks.map((task: EntryTask) => {
                const completed = isEntered && isTaskCompleted(task.id)
                const isLoading = completingTaskId === task.id
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                      completed
                        ? 'border-emerald-300/20 bg-emerald-300/8'
                        : 'border-white/10 bg-white/6'
                    }`}
                  >
                    {/* Task icon */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        completed
                          ? 'bg-emerald-300/20 text-emerald-100'
                          : 'border border-white/10 bg-white/8 text-[var(--shop-muted)]'
                      }`}
                    >
                      {task.type === 'join_channel' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
                          <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                      ) : task.type === 'invite_friend' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
                          <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
                          <path d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                        </svg>
                      )}
                    </div>

                    {/* Task info */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${completed ? 'text-emerald-100' : 'text-[var(--shop-cream)]'}`}>
                        {task.label}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                        {isEntered
                          ? `+${task.ticketsGranted} ticket${task.ticketsGranted !== 1 ? 's' : ''}`
                          : 'Join first to unlock'}
                      </p>
                    </div>

                    {/* Action button */}
                    {completed ? (
                      <span className="shrink-0 rounded-lg bg-emerald-300/20 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">
                        ✓ Done
                      </span>
                    ) : isLoading ? (
                      <span className="shrink-0 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                        ...
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCompleteTask(task.id)}
                        disabled={!isEntered}
                        className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition-all active:scale-95 ${
                          isEntered
                            ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                            : 'border border-white/10 bg-white/8 text-[var(--shop-muted)]'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {isEntered ? 'Complete' : 'Locked'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── WINNERS (if drawn) ── */}
        {hasAnyWinner && giveaway.winners ? (
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
              Winners
            </p>
            <div className="space-y-2">
              {giveaway.winners.map((winner) => {
                const placeLabel =
                  winner.place === 1 ? '1st' : winner.place === 2 ? '2nd' : winner.place === 3 ? '3rd' : `${winner.place}th`
                return (
                  <div
                    key={winner.place}
                    className="flex items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/8 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true">
                        <g transform="translate(2, 2)">
                          <path
                            fillRule="evenodd"
                            d="M10 1a4 4 0 00-4 4c0 1.5.55 2.88 1.46 3.93L4.3 13.3a.75.75 0 00.53 1.2h10.34a.75.75 0 00.53-1.2l-1.16-2.37A3.99 3.99 0 0012 5a4 4 0 00-4-4zm0 14a2.5 2.5 0 01-2.12-1.17h4.24A2.5 2.5 0 0110 15z"
                            clipRule="evenodd"
                          />
                        </g>
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--shop-cream)]">
                        {winner.telegramUsername
                          ? `@${winner.telegramUsername}`
                          : `User #${winner.telegramUserId}`}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                        {winner.productName || 'Prize'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-400">
                      {placeLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* ── JOIN / ENTERED BUTTON ── */}
        {!hasEnded && (
          <button
            type="button"
            onClick={isEntered ? undefined : handleJoin}
            disabled={isEntered || isJoining}
            className={`w-full rounded-2xl px-4 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
              isEntered
                ? 'bg-emerald-300/15 text-emerald-100 shadow-none'
                : 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] shadow-[0_8px_24px_rgba(139,61,255,0.3)] disabled:opacity-50'
            }`}
          >
            {isJoining
              ? 'Joining...'
              : isEntered
                ? `✓ ENTERED (${myTickets} Ticket${myTickets !== 1 ? 's' : ''})`
                : `ENTER GIVEAWAY (${giveaway.baseEntryTickets} Ticket${giveaway.baseEntryTickets !== 1 ? 's' : ''})`}
          </button>
        )}

        {/* ── JOIN RESULT TOAST ── */}
        <AnimatePresence>
          {joinResultText && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-center text-sm font-semibold text-emerald-100"
            >
              {joinResultText}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LEADERBOARD (top 5) ── */}
        {isEntered && sortedEntries.length > 1 && (
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
              Leaderboard
            </p>
            <div className="space-y-1.5">
              {sortedEntries.slice(0, 5).map((entry, index) => {
                const isMe = entry.telegramUserId === myEntry?.telegramUserId
                return (
                  <div
                    key={entry.telegramUserId}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                      isMe ? 'border border-[var(--shop-purple)]/30 bg-[var(--shop-purple)]/8' : 'bg-white/6'
                    }`}
                  >
                    <span className={`w-5 text-center text-xs font-bold ${
                      index === 0 ? 'text-amber-400' : index === 1 ? 'text-zinc-300' : index === 2 ? 'text-amber-700' : 'text-[var(--shop-muted)]'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-[var(--shop-cream)]">
                      {entry.telegramUsername
                        ? `@${entry.telegramUsername}`
                        : `User #${entry.telegramUserId}`}
                      {isMe && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-purple)]">
                          You
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-[var(--shop-muted)]">
                      {entry.totalTickets} ticket{entry.totalTickets !== 1 ? 's' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
