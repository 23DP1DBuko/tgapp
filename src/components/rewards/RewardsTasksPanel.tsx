import { useCallback, useEffect, useMemo, useState } from 'react'

import { listGiveaways } from '../../lib/firebase/giveaways'
import { toggleBroadcastSubscription } from '../../lib/firebase/notifySubscribers'
import { toggleLeaderboardVisibility } from '../../lib/firebase/consent'
import { useReferral } from '../../hooks/useReferral'
import { fetchReferralLeaderboard } from '../../lib/firebase/referral'
import type { ReferralLeaderboardEntry } from '../../lib/firebase/referral'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'

import { PageHeader } from '../ui/PageHeader'
import { BuyerGiveawayDetailSheet } from './BuyerGiveawayDetailSheet'
import { Button } from '../ui/Button'
import { useDailyCheckin } from '../../hooks/useDailyCheckin'
import type { Giveaway } from '../../types/rewards'

type RewardsTasksPanelProps = {
  initData: string
  hasTelegramAccess: boolean
  onBack: () => void
  onGiveawayDetailChange?: (isOpen: boolean) => void
  onOpenPolls?: () => void
}

const GIVEAWAY_DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80'

type CountdownDisplay = {
  label: string
  value: number
}

function computeCountdown(endsAt: string | null, nowOverride?: number): CountdownDisplay[] | null {
  if (!endsAt) return null

  const target = new Date(endsAt).getTime()
  const now = nowOverride ?? Date.now()
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
  initData,
  hasTelegramAccess,
  onBack,
  onGiveawayDetailChange,
  onOpenPolls,
}: RewardsTasksPanelProps) {
  void hasTelegramAccess
  const { referralInfo, referralLink, rewardMilestones } = useReferral(initData)
  const { checkinState, isCheckingIn, handleCheckIn, feedback: checkinFeedback } = useDailyCheckin(initData)
  const [leaderboardEntries, setLeaderboardEntries] = useState<ReferralLeaderboardEntry[]>([])
  const [myLeaderboardRank, setMyLeaderboardRank] = useState<number | null>(null)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [copiedReferral, setCopiedReferral] = useState(false)
  const [copiedMilestoneCode, setCopiedMilestoneCode] = useState<string | null>(null)
  const [giveaways, setGiveaways] = useState<Giveaway[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGiveaway, setSelectedGiveaway] = useState<Giveaway | null>(null)
  const [now, setNow] = useState(Date.now())
  const [broadcastSubscribed, setBroadcastSubscribed] = useState<boolean | null>(null)
  const [togglingBroadcast, setTogglingBroadcast] = useState(false)
  const [leaderboardShown, setLeaderboardShown] = useState<boolean>(true)
  const [togglingLeaderboard, setTogglingLeaderboard] = useState(false)

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
        const g = await listGiveaways(50)
        if (!isCancelled) {
          setGiveaways(g)
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

  const activeGiveaways = useMemo(
    () => giveaways.filter((g) => g.status === 'live'),
    [giveaways],
  )

  function handleOpenGiveawayDetail(giveaway: Giveaway) {
    triggerHapticFeedback('light')
    setSelectedGiveaway(giveaway)
    onGiveawayDetailChange?.(true)
  }

  function handleCloseGiveawayDetail() {
    setSelectedGiveaway(null)
    onGiveawayDetailChange?.(false)
  }

  // ── Broadcast subscription: fetch status on mount, toggle on tap ──
  useEffect(() => {
    if (!initData) return
    let cancelled = false
    async function fetchStatus() {
      try {
        const result = await toggleBroadcastSubscription(initData)
        if (!cancelled) setBroadcastSubscribed(result.allowBroadcasts)
      } catch {
        if (!cancelled) setBroadcastSubscribed(true) // sensible default
      }
    }
    void fetchStatus()
    return () => { cancelled = true }
  }, [initData])

  const handleToggleBroadcast = useCallback(async () => {
    if (!initData || togglingBroadcast || broadcastSubscribed === null) return
    const newValue = !broadcastSubscribed
    setTogglingBroadcast(true)
    try {
      const result = await toggleBroadcastSubscription(initData, newValue)
      setBroadcastSubscribed(result.allowBroadcasts)
      triggerHapticFeedback('medium')
    } catch {
      // Silently fail – keep current state
    } finally {
      setTogglingBroadcast(false)
    }
  }, [initData, togglingBroadcast, broadcastSubscribed])

  // ── Leaderboard visibility toggle ──
  const handleToggleLeaderboard = useCallback(async () => {
    if (!initData || togglingLeaderboard) return
    const newValue = !leaderboardShown
    setTogglingLeaderboard(true)
    try {
      const result = await toggleLeaderboardVisibility(initData, newValue)
      setLeaderboardShown(result.leaderboardShown)
      triggerHapticFeedback('medium')
    } catch {
      // Silently fail — keep current state
    } finally {
      setTogglingLeaderboard(false)
    }
  }, [initData, togglingLeaderboard, leaderboardShown])

  // ── Fetch leaderboard on mount ──
  useEffect(() => {
    if (!initData) return

    let cancelled = false

    async function load() {
      setLeaderboardLoading(true)
      try {
        const result = await fetchReferralLeaderboard(initData)
        if (!cancelled) {
          setLeaderboardEntries(result.topReferrers)
          setMyLeaderboardRank(result.myRank)
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLeaderboardLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [initData])

  async function handleRefreshGiveaways() {
    try {
      const [g] = await Promise.all([listGiveaways(50)])
      setGiveaways(g)
    } catch {
      // Use existing state
    }
  }

  const handleCopyReferral = useCallback(() => {
    if (!referralLink) return
    triggerHapticFeedback('medium')
    try {
      void navigator.clipboard.writeText(referralLink)
      setCopiedReferral(true)
      setTimeout(() => setCopiedReferral(false), 2000)
    } catch {
      // Clipboard write failed silently
    }
  }, [referralLink])

  const referralCount = referralInfo?.referralCount ?? 0

  function formatFomoText(g: Giveaway): string {
    return `${g.enteredCount} Participant${g.enteredCount !== 1 ? 's' : ''} • ${g.totalTicketsPool} Ticket${g.totalTicketsPool !== 1 ? 's' : ''}`
  }

  return (
    <div className="animate-[fade-slide-in_0.4s_ease-out_backwards]">
      <div className="space-y-4">
      {/* Back button */}
      <PageHeader label="Catalog" onClick={onBack} />

      {/* ── STACK A: Live Giveaways ── */}
      <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.96),rgba(18,10,24,0.98))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Live Giveaways
          </p>
          <span className="rounded-full bg-[var(--shop-purple)]/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-purple)]">
            {activeGiveaways.length > 0 ? activeGiveaways.length === 1 ? '1 Active' : `${activeGiveaways.length} Active` : 'None Running'}
          </span>
        </div>

        {loading ? (
          <p className="mt-4 rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
            Loading giveaways...
          </p>
        ) : activeGiveaways.length > 0 ? (
          <div className="mt-4 space-y-5">
            {activeGiveaways.map((g) => {
              const gCountdown = computeCountdown(g.endAt ?? null, now)
              return (
                <div key={g.id} className="rounded-[20px] border border-white/10 bg-black/10 p-4">
                  {/* Giveaway image */}
                  <div className="overflow-hidden rounded-[16px] border border-white/10 bg-black/20">
                    <img
                      src={g.imageUrl || g.prizes[0]?.productImage || GIVEAWAY_DEFAULT_IMAGE}
                      alt={g.title || g.prizes[0]?.productName || 'Giveaway'}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </div>

                  {/* Product name + ticket info */}
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
                        {g.title || g.prizes[0]?.productName || 'Giveaway'}
                      </h3>
                      <p className="mt-0.5 text-xs text-[var(--shop-muted)]">
                        {g.totalTicketsPool} tickets available
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--shop-red)]/18 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
                      Free Entry
                    </span>
                  </div>

                  {/* Countdown timer */}
                  {gCountdown ? (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {gCountdown.map((unit) => (
                        <div
                          key={unit.label}
                          className="rounded-xl border border-white/10 bg-black/20 px-2 py-2.5 text-center"
                        >
                          <p className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
                            {String(unit.value).padStart(2, '0')}
                          </p>
                          <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                            {unit.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* View Details / Enter button */}
                  <button
                    type="button"
                    onClick={() => handleOpenGiveawayDetail(g)}
                    className="mt-3 w-full rounded-2xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-[0_8px_24px_rgba(139,61,255,0.3)] transition-all active:scale-[0.98]"
                  >
                    VIEW DETAILS
                  </button>

                  {/* FOMO ticker */}
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white/6 px-4 py-2.5">
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-3.5 w-3.5 shrink-0 text-[var(--shop-magenta)]"
                      aria-hidden="true"
                    >
                      <g transform="translate(2, 2)">
                        <path d="M10 1a6 6 0 00-6 6c0 1.5.55 2.88 1.46 3.93L4.3 13.3a.75.75 0 00.53 1.2h10.34a.75.75 0 00.53-1.2l-1.16-2.37A5.99 5.99 0 0016 7a6 6 0 00-6-6zm0 14a2.5 2.5 0 01-2.12-1.17h4.24A2.5 2.5 0 0110 15z" />
                      </g>
                    </svg>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-muted)]">
                      {formatFomoText(g)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/8 px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/6">
              <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 12v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2" />
                <path d="M4 12v5a2 2 0 002 2h12a2 2 0 002-2v-5" />
                <path d="M12 7V4" />
                <path d="M10 4h4" />
                <path d="M12 15v-3" />
                <path d="M9 13l3 3 3-3" />
              </svg>
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-300">
              No active giveaways right now.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Complete tasks below to get a ticket when the next one drops.
            </p>
          </div>
        )}
      </article>

      {/* ── STACK A.5: Recent Winners (giveaways with drawn results) ── */}
      {giveaways.filter((g) => g.winners && g.winners.length > 0 && g.status !== 'live').length > 0 && (
        <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.96),rgba(18,10,24,0.98))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              Recent Winners
            </p>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400">
              Drawn
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {giveaways
              .filter((g) => g.winners && g.winners.length > 0 && g.status !== 'live')
              .slice(0, 3)
              .map((g) => (
                <div
                  key={g.id}
                  className="overflow-hidden rounded-[20px] border border-emerald-300/12 bg-black/20"
                >
                  {/* Prize image */}
                  <div className="aspect-[4/1] w-full overflow-hidden">
                    <img
                      src={g.prizes[0]?.productImage || GIVEAWAY_DEFAULT_IMAGE}
                      alt={g.prizes[0]?.productName || 'Prize'}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--shop-cream)]">
                      {g.prizes[0]?.productName || g.title || 'Giveaway'}
                    </p>
                    <div className="mt-2 space-y-1">
                      {g.winners!.slice(0, 3).map((w) => (
                        <div key={w.place} className="flex items-center gap-2 text-xs">
                          <span className="shrink-0">
                            {w.place === 1 ? '🥇' : w.place === 2 ? '🥈' : '🥉'}
                          </span>
                          <span className="font-medium text-emerald-100">
                            {w.telegramUsername ? `@${w.telegramUsername}` : `User #${w.telegramUserId}`}
                          </span>
                        </div>
                      ))}
                      {g.winners!.length > 3 && (
                        <p className="text-[11px] text-[var(--shop-muted)]">
                          +{g.winners!.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </article>
      )}

      {/* ── STACK B: Daily Check-In ── */}
      <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.96),rgba(18,10,24,0.98))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Daily Check-In
          </p>
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
              checkinState.todayCheckedIn
                ? 'bg-emerald-300/15 text-emerald-100'
                : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {checkinState.todayCheckedIn ? 'Checked In' : `${checkinState.currentStreak}-day`}
          </span>
        </div>

        <p className="mt-2 text-xs leading-5 text-zinc-400">
          Check in daily. Build your streak. Unlock exclusive discounts.
        </p>

        {/* Streak display */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))]">
            <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
              {checkinState.currentStreak}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Day Streak
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
              {checkinState.totalCheckIns}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Total Check-Ins
            </p>
          </div>
        </div>

        {/* Milestone progress bar — dynamically compute next milestone */}
        {(() => {
          const milestones = [3, 7, 14, 30]
          const nextThreshold = milestones.find((m) => m > checkinState.currentStreak)
          const label = nextThreshold ? `${nextThreshold} days` : 'All unlocked!'
          const pct = nextThreshold
            ? Math.min((checkinState.currentStreak / nextThreshold) * 100, 100)
            : 100
          return (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                <span>Next Reward</span>
                <span>{label}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--shop-purple),var(--shop-red))] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })()}

        {/* Check-in button + feedback */}
        <Button
          onClick={handleCheckIn}
          disabled={isCheckingIn || checkinState.todayCheckedIn}
          loading={isCheckingIn}
          variant={checkinState.todayCheckedIn ? 'success' : 'primary'}
          size="lg"
          fullWidth
          className="mt-4"
        >
          {checkinState.todayCheckedIn
            ? `✓ CHECKED IN (Day ${checkinState.currentStreak})`
            : 'CHECK IN TODAY'}
        </Button>

        {checkinFeedback && (
          <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-center text-xs font-semibold text-emerald-100">
            {checkinFeedback}
          </div>
        )}

        {/* Milestone roadmap */}
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            Milestones
          </p>
          {[
            { days: 3, label: '5% OFF' },
            { days: 7, label: '10% OFF' },
            { days: 14, label: '15% OFF' },
            { days: 30, label: '25% OFF' },
          ].map((milestone) => {
            const unlocked = checkinState.currentStreak >= milestone.days
            return (
              <div
                key={milestone.days}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                  unlocked
                    ? 'border-emerald-300/20 bg-emerald-300/8'
                    : 'border-white/10 bg-white/6'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    unlocked
                      ? 'bg-emerald-300/20 text-emerald-100'
                      : 'border border-white/10 bg-white/8 text-[var(--shop-muted)]'
                  }`}
                >
                  {unlocked ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true">
                      <g transform="translate(2, 2)">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </g>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true">
                      <g transform="translate(2, 2)">
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </g>
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--shop-cream)]">
                    {milestone.days}-Day Streak
                    {unlocked ? ' — Unlocked' : ''}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    {milestone.label}
                  </p>
                </div>
                {unlocked ? (
                  <span className="shrink-0 rounded-lg bg-emerald-300/20 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">
                    ✓ Done
                  </span>
                ) : (
                  <span className="shrink-0 rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                    {checkinState.currentStreak}/{milestone.days}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </article>

      {/* ── STACK C: Your Referral Link ── */}
      <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Your Referral Link
          </p>
          {referralLink ? (
            <span className="rounded-full bg-emerald-300/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
              {referralCount} {referralCount === 1 ? 'Referral' : 'Referrals'}
            </span>
          ) : null}
        </div>

        <p className="mt-2 text-xs leading-5 text-zinc-400">
          Invite friends. Earn store credit and giveaway tickets.
        </p>

        {referralLink ? (
          <>
            {/* Referral code badge */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-[var(--shop-purple)]" aria-hidden="true">
                <g transform="translate(2, 2)">
                  <path
                    fillRule="evenodd"
                    d="M12.232 4.232a3 3 0 014.242 4.242L9.343 15.61a5 5 0 01-7.07-7.07l4.243-4.243a1 1 0 011.414 1.414l-4.242 4.243a3 3 0 004.242 4.242l7.071-7.07a1 1 0 00-1.414-1.415l-1.414 1.415a3 3 0 01-4.242-4.243l1.414-1.414z"
                    clipRule="evenodd"
                  />
                </g>
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shop-cream)]">
                  Your Referral Code
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold tracking-[-0.02em] text-[var(--shop-purple)]">
                  {referralInfo?.referralCode ?? '...'}
                </p>
              </div>
            </div>

            {/* Reward milestones: unlocked promo codes */}
            {rewardMilestones.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
                  Unlocked Rewards
                </p>
                {rewardMilestones.map((milestone) => (
                  <div
                    key={milestone.threshold}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                      milestone.granted
                        ? 'border-emerald-300/20 bg-emerald-300/8'
                        : 'border-white/10 bg-white/6 opacity-50'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        milestone.granted
                          ? 'bg-emerald-300/20 text-emerald-100'
                          : 'border border-white/10 bg-white/8 text-[var(--shop-muted)]'
                      }`}
                    >
                      {milestone.granted ? (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true">
                          <g transform="translate(2, 2)">
                            <path d="M10 1a6 6 0 00-6 6c0 1.5.55 2.88 1.46 3.93L4.3 13.3a.75.75 0 00.53 1.2h10.34a.75.75 0 00.53-1.2l-1.16-2.37A5.99 5.99 0 0016 7a6 6 0 00-6-6zm0 14a2.5 2.5 0 01-2.12-1.17h4.24A2.5 2.5 0 0110 15z" />
                          </g>
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--shop-cream)]">
                        {milestone.threshold} {milestone.threshold === 1 ? 'Referral' : 'Referrals'}
                        {milestone.granted ? ' — Unlocked' : ''}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                        {milestone.granted
                          ? `CODE: ${milestone.promoCode}`
                          : `${milestone.discountPercent}% OFF`}
                      </p>
                    </div>
                    {milestone.granted ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!milestone.promoCode) return
                          triggerHapticFeedback('light')
                          try {
                            void navigator.clipboard.writeText(milestone.promoCode)
                            setCopiedMilestoneCode(milestone.promoCode)
                            setTimeout(() => setCopiedMilestoneCode(null), 2000)
                          } catch {
                            // Clipboard write failed silently
                          }
                        }}
                        className="shrink-0 rounded-lg bg-emerald-300/20 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100"
                      >
                        {copiedMilestoneCode === milestone.promoCode ? 'COPIED!' : 'Copy Code'}
                      </button>
                    ) : (
                      <span className="shrink-0 rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                        Locked
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Copy referral link button */}
            <Button
              onClick={handleCopyReferral}
              variant={copiedReferral ? 'success' : 'primary'}
              size="lg"
              fullWidth
              className="mt-3"
            >
              {copiedReferral ? '✓ COPIED!' : 'COPY REFERRAL LINK'}
            </Button>

            {/* Referral count card */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center">
                <p className="text-xl font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
                  {referralCount}
                </p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                  Referrals
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center">
                <p className="text-xl font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
                  {referralCount >= 3 ? '3+' : `${referralCount} / 3`}
                </p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                  Next Milestone
                </p>
              </div>
            </div>

            {/* Leaderboard visibility toggle */}
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--shop-cream)]">
                  Show in Leaderboard
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                  {leaderboardShown ? 'Your username is public' : 'Only visible to you'}
                </p>
              </div>                <button
                  type="button"
                  role="switch"
                  aria-checked={leaderboardShown}
                  aria-label="Toggle leaderboard visibility"
                  onClick={handleToggleLeaderboard}
                  disabled={togglingLeaderboard}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-all duration-200 disabled:opacity-40 ${
                    leaderboardShown ? 'bg-[var(--shop-purple)]' : 'bg-white/15'
                  }`}
                >
                <span
                  className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                    leaderboardShown ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Leaderboard */}
            {leaderboardEntries.length > 0 ? (
              <div className="mt-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
                  Top Referrers
                </p>
                <div className="space-y-1.5">
                  {leaderboardEntries.map((entry) => {
                    const isMe = entry.telegramUserId === referralInfo?.telegramUserId
                    return (
                      <div
                        key={entry.telegramUserId}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                          isMe ? 'border border-[var(--shop-purple)]/30 bg-[var(--shop-purple)]/8' : 'bg-white/6'
                        }`}
                      >
                        <span className={`w-5 text-center text-xs font-bold ${
                          entry.rank === 1 ? 'text-amber-400' : entry.rank === 2 ? 'text-zinc-300' : entry.rank === 3 ? 'text-amber-700' : 'text-[var(--shop-muted)]'
                        }`}>
                          {entry.rank}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium text-[var(--shop-cream)]">
                          {entry.username
                            ? `@${entry.username}`
                            : `User #${entry.telegramUserId}`}
                          {isMe && (
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-purple)]">
                              You
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-[var(--shop-muted)]">
                          {entry.referralCount} {entry.referralCount === 1 ? 'ref' : 'refs'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {myLeaderboardRank !== null && !leaderboardEntries.some((e) => e.telegramUserId === referralInfo?.telegramUserId) && (
                  <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                    Your rank: #{myLeaderboardRank} ({referralCount} referrals)
                  </div>
                )}
              </div>
            ) : !leaderboardLoading ? (
              <div className="mt-5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                Be the first to invite friends!
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/8 px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/6">
              <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-300">
              Open the app in Telegram to generate your link.
            </p>
          </div>
        )}
      </article>

      {/* ── STACK D: Broadcast Subscription ── */}
      <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Broadcast Messages
          </p>
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
              broadcastSubscribed === null
                ? 'bg-white/8 text-[var(--shop-muted)]'
                : broadcastSubscribed
                  ? 'bg-emerald-300/15 text-emerald-100'
                  : 'bg-white/8 text-[var(--shop-muted)]'
            }`}
          >
            {broadcastSubscribed === null
              ? '—'
              : broadcastSubscribed
                ? 'Subscribed'
                : 'Unsubscribed'}
          </span>
        </div>

        <p className="mt-2 text-xs leading-5 text-zinc-400">
          Get notified when new drops arrive, giveaways go live, or exclusive offers drop. You can toggle this anytime.
        </p>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              broadcastSubscribed
                ? 'bg-[var(--shop-purple)]/20 text-[var(--shop-purple)]'
                : 'border border-white/10 bg-white/8 text-[var(--shop-muted)]'
            }`}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true">
                <g transform="translate(2, 2)">
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                    clipRule="evenodd"
                  />
                </g>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--shop-cream)]">
                {broadcastSubscribed === null
                  ? 'Loading...'
                  : broadcastSubscribed
                    ? 'You receive broadcasts'
                    : 'Broadcasts are off'}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                {broadcastSubscribed === null
                  ? 'Check your status'
                  : broadcastSubscribed
                    ? 'Toggle to unsubscribe'
                    : 'Toggle to receive updates'}
              </p>
            </div>
          </div>            <button
              type="button"
              role="switch"
              aria-checked={broadcastSubscribed === true}
              aria-label="Toggle broadcast notifications"
              onClick={handleToggleBroadcast}
              disabled={togglingBroadcast || broadcastSubscribed === null}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-all duration-200 disabled:opacity-40 ${
                broadcastSubscribed ? 'bg-[var(--shop-purple)]' : 'bg-white/15'
              }`}
            >
            <span
              className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                broadcastSubscribed ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </article>    </div>

      {/* ── STACK E: Community Polls (entry point) ── */}
      {onOpenPolls && (
        <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              Community Polls
            </p>
            <span className="rounded-full bg-[var(--shop-purple)]/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-purple)]">
              Vote Now
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-400">
            Vote on what we should drop next. Shape the future of the collection.
          </p>
          <Button
            onClick={() => onOpenPolls?.()}
            variant="primary"
            size="lg"
            fullWidth
            className="mt-4"
          >
            View Active Polls
          </Button>
        </article>
      )}

      {/* ── GIVEAWAY DETAIL SHEET ── */}
      <BuyerGiveawayDetailSheet
        isOpen={selectedGiveaway !== null}
        giveaway={selectedGiveaway}
        initData={initData}
        onClose={handleCloseGiveawayDetail}
        onEntryChanged={handleRefreshGiveaways}
      />
    </div>
  )
}
