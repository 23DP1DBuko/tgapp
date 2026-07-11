import { useEffect, useMemo, useState } from 'react'

import { listGiveaways } from '../../lib/firebase/giveaways'
import { listTasks } from '../../lib/firebase/tasks'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import type { Giveaway } from '../../types/rewards'
import type { Task } from '../../types/rewards'

type RewardsTasksPanelProps = {
  initData: string
  hasTelegramAccess: boolean
  onBack: () => void
}

const GIVEAWAY_DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80'

type CountdownDisplay = {
  label: string
  value: number
}

function computeCountdown(endsAt: string | null): CountdownDisplay[] | null {
  if (!endsAt) return null

  const target = new Date(endsAt).getTime()
  const now = Date.now()
  const diff = Math.max(0, target - now)

  if (diff === 0) return null

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

export function RewardsTasksPanel({
  initData: _initData,
  hasTelegramAccess,
  onBack,
}: RewardsTasksPanelProps) {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [enteredGiveawayId, setEnteredGiveawayId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function load() {
      setLoading(true)
      try {
        const [g, t] = await Promise.all([listGiveaways(5), listTasks(10)])
        if (!isCancelled) {
          setGiveaways(g)
          setTasks(t)
        }
      } catch {
        // Use empty state
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    void load()
    return () => { isCancelled = true }
  }, [])

  const activeGiveaway = useMemo(
    () => giveaways.find((g) => g.isActive) ?? null,
    [giveaways],
  )

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks],
  )

  const countdown = useMemo(
    () => computeCountdown(activeGiveaway?.endsAt ?? null),
    [activeGiveaway?.endsAt, now],
  )

  function handleEnterGiveaway() {
    if (!hasTelegramAccess) return
    if (!activeGiveaway) return

    triggerHapticFeedback('medium')
    setEnteredGiveawayId(activeGiveaway.id)

    setTimeout(() => {
      setEnteredGiveawayId(null)
    }, 2500)
  }

  function handleShareLink() {
    triggerHapticFeedback('light')
    const referralLink = 'https://t.me/share/url?url=https://t.me/YungWearBot&text=Check out YUNGWEAR drops!'
    window.open(referralLink, '_blank')
  }

  function handleJoinChannel() {
    triggerHapticFeedback('light')
    window.open('https://t.me/yungwear', '_blank')
  }

  const fomoText = useMemo(() => {
    if (!activeGiveaway) return null
    const pct = Math.round((activeGiveaway.enteredCount / Math.max(activeGiveaway.totalTickets, 1)) * 100)
    const suffix = activeGiveaway.enteredCount === 1 ? 'person has' : 'people have'
    return `${activeGiveaway.enteredCount} ${suffix} entered · ${pct}% claimed`
  }, [activeGiveaway])

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
      >
        ← Back To Catalog
      </button>

      {/* ── STACK A: Live Giveaways ── */}
      <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.96),rgba(18,10,24,0.98))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Live Giveaways
          </p>
          <span className="rounded-full bg-[var(--shop-purple)]/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-purple)]">
            {activeGiveaway ? 'Active' : 'None Running'}
          </span>
        </div>

        {loading ? (
          <p className="mt-4 rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
            Loading giveaways...
          </p>
        ) : activeGiveaway ? (
          <>
            {/* Product image */}
            <div className="mt-5 overflow-hidden rounded-[20px] border border-white/10 bg-black/20">
              <img
                src={activeGiveaway.productImage || GIVEAWAY_DEFAULT_IMAGE}
                alt={activeGiveaway.productName}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>

            {/* Product name + ticket info */}
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
                  {activeGiveaway.productName}
                </h3>
                <p className="mt-1 text-xs text-[var(--shop-muted)]">
                  {activeGiveaway.totalTickets} tickets available
                </p>
              </div>
              <span className="rounded-full bg-[var(--shop-red)]/18 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
                Free Entry
              </span>
            </div>

            {/* Countdown timer */}
            {countdown ? (
              <div className="mt-5 grid grid-cols-4 gap-2">
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
              <div className="mt-5 rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-center">
                <p className="text-sm font-semibold text-[var(--shop-red)]">GIVEAWAY ENDED</p>
              </div>
            )}

            {/* Enter button */}
            <button
              type="button"
              onClick={handleEnterGiveaway}
              disabled={!countdown || enteredGiveawayId !== null}
              className={`mt-5 w-full rounded-2xl px-4 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
                enteredGiveawayId === activeGiveaway.id
                  ? 'bg-emerald-300/20 text-emerald-100 shadow-none'
                  : 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] shadow-[0_8px_24px_rgba(139,61,255,0.3)] disabled:opacity-50 disabled:shadow-none'
              }`}
            >
              {enteredGiveawayId === activeGiveaway.id
                ? '✓ ENTERED!'
                : `ENTER GIVEAWAY (1 Ticket)`}
            </button>

            {/* FOMO ticker */}
            {fomoText ? (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white/6 px-4 py-3">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4 text-[var(--shop-magenta)]"
                  aria-hidden="true"
                >
                  <path d="M10 1a6 6 0 00-6 6c0 1.5.55 2.88 1.46 3.93L4.3 13.3a.75.75 0 00.53 1.2h10.34a.75.75 0 00.53-1.2l-1.16-2.37A5.99 5.99 0 0016 7a6 6 0 00-6-6zm0 14a2.5 2.5 0 01-2.12-1.17h4.24A2.5 2.5 0 0110 15z" />
                </svg>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shop-muted)]">
                  {fomoText}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-4 rounded-2xl bg-white/8 px-4 py-8 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            No active giveaways right now. Complete tasks below to get a ticket when the next one drops.
          </div>
        )}
      </article>

      {/* ── STACK B: Social Growth Tasks ── */}
      <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Social Growth Tasks
          </p>
          <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-cream)]">
            {activeTasks.length} Active
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
          Complete tasks to earn rewards and giveaway entries.
        </p>

        <div className="mt-5 space-y-3">
          {activeTasks.length === 0 ? (
            <>
              {/* Default Row 1: Invite Friends */}
              <div className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-white/6 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[var(--shop-purple)]" aria-hidden="true">
                    <path d="M10 1a6 6 0 00-6 6c0 1.5.55 2.88 1.46 3.93L4.3 13.3a.75.75 0 00.53 1.2h10.34a.75.75 0 00.53-1.2l-1.16-2.37A5.99 5.99 0 0016 7a6 6 0 00-6-6z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--shop-cream)]">
                    Invite 3 Friends via Referral Link
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    10% OFF COUPON
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleShareLink}
                  className="shrink-0 rounded-xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_4px_12px_rgba(139,61,255,0.25)]"
                >
                  Share Link
                </button>
              </div>

              {/* Default Row 2: Subscribe to Channel */}
              <div className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-white/6 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[var(--shop-magenta)]" aria-hidden="true">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--shop-cream)]">
                    Subscribe to YUNGWEAR Channel
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    Free Giveaway Ticket
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleJoinChannel}
                  className="shrink-0 rounded-xl border border-white/12 bg-white/8 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
                >
                  Join & Verify
                </button>
              </div>
            </>
          ) : (
            activeTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-white/6 p-4"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8`}>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[var(--shop-purple)]" aria-hidden="true">
                    <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--shop-cream)]">
                    {task.title}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    {task.rewardValue}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                  {task.rewardType === 'ticket' ? 'Get Ticket' : 'Claim'}
                </span>
              </div>
            ))
          )}
        </div>
      </article>
    </div>
  )
}
