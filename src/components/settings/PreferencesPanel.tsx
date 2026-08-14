import { useCallback, useEffect, useState } from 'react'

import { toggleBroadcastSubscription } from '../../lib/firebase/broadcasts'
import {
  getUserSettings,
  toggleLeaderboardVisibility,
} from '../../lib/firebase/consent'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { setReducedMotionPreference } from '../../lib/motionPrefs'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import { useI18n } from '../../lib/i18n'
import type { Language } from '../../lib/i18n/translations'
import { CustomSelect, type CustomSelectOption } from '../ui/CustomSelect'
import { PageHeader } from '../ui/PageHeader'

const LANGUAGE_OPTIONS: CustomSelectOption[] = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'lv', label: 'Latviešu' },
]

type PreferencesPanelProps = {
  initData: string
  onBack: () => void
  onError?: (message: string) => void
}

export function PreferencesPanel({ initData, onBack, onError }: PreferencesPanelProps) {
  const reducedMotion = useReducedMotion()
  const { language, setLanguage, t } = useI18n()

  // ── Broadcast subscription (server-backed state on telegramSubscribers) ──
  const [broadcastSubscribed, setBroadcastSubscribed] = useState<boolean | null>(null)
  const [togglingBroadcast, setTogglingBroadcast] = useState(false)

  // ── Leaderboard visibility (server-backed state on userSettings) ──
  const [leaderboardShown, setLeaderboardShown] = useState<boolean | null>(null)
  const [togglingLeaderboard, setTogglingLeaderboard] = useState(false)

  useEffect(() => {
    if (!initData) return
    let cancelled = false

    async function fetchStatus() {
      try {
        // No argument = read-only status request
        const result = await toggleBroadcastSubscription(initData)
        if (!cancelled) setBroadcastSubscribed(result.allowBroadcasts)
      } catch {
        if (!cancelled) setBroadcastSubscribed(true)
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
      // Surface the failure instead of failing silently — the toggle stays as it was
      onError?.(t('settings.toggleError'))
    } finally {
      setTogglingBroadcast(false)
    }
  }, [initData, togglingBroadcast, broadcastSubscribed, onError, t])

  // ── Leaderboard visibility: fetch current state on mount, toggle on tap ──
  useEffect(() => {
    if (!initData) return
    let cancelled = false

    async function fetchStatus() {
      try {
        const result = await getUserSettings(initData)
        if (!cancelled) setLeaderboardShown(result.leaderboardShown)
      } catch {
        // Keep the server default (true)
      }
    }

    void fetchStatus()
    return () => { cancelled = true }
  }, [initData])

  const handleToggleLeaderboard = useCallback(async () => {
    if (!initData || togglingLeaderboard || leaderboardShown === null) return
    const newValue = !leaderboardShown
    setTogglingLeaderboard(true)
    try {
      const result = await toggleLeaderboardVisibility(initData, newValue)
      setLeaderboardShown(result.leaderboardShown)
      triggerHapticFeedback('medium')
    } catch {
      // Surface the failure instead of failing silently
      onError?.(t('settings.toggleError'))
    } finally {
      setTogglingLeaderboard(false)
    }
  }, [initData, togglingLeaderboard, leaderboardShown, onError, t])

  // ── Language (client-side only, persisted in localStorage by the provider) ──
  function handleLanguageChange(value: string) {
    setLanguage(value as Language)
    triggerHapticFeedback('light')
  }

  // ── Reduced motion (localStorage override; drives useReducedMotion) ──
  // `reducedMotion` above already reflects the override after each toggle.
  function handleMotionToggle() {
    triggerHapticFeedback('light')
    setReducedMotionPreference(!reducedMotion)
  }

  return (
    <>
      <PageHeader label={t('settings.preferences')} onClick={onBack} />

      <article className="animate-[fade-slide-in_0.4s_ease-out_backwards] rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
          {t('settings.preferences')}
        </p>

        {/* ── Subscribe to broadcasts ── */}
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--shop-cream)]">
              {t('rewards.broadcast')}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
              {t('settings.broadcastHint')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={broadcastSubscribed === true}
            aria-label={t('settings.broadcastToggleAria')}
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

        {/* ── Leaderboard visibility ── */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--shop-cream)]">
              {t('rewards.showLeaderboard')}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
              {leaderboardShown === false
                ? t('rewards.onlyVisibleToYou')
                : t('rewards.usernamePublic')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={leaderboardShown === true}
            aria-label={t('settings.leaderboardToggleAria')}
            onClick={handleToggleLeaderboard}
            disabled={togglingLeaderboard || leaderboardShown === null}
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

        {/* ── Language selector ── */}
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3.5">
          <p className="text-sm font-semibold text-[var(--shop-cream)]">
            {t('settings.language')}
          </p>
          <p className="mt-1 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
            {t('settings.languageHint')}
          </p>
          <CustomSelect
            value={language}
            options={LANGUAGE_OPTIONS}
            onChange={handleLanguageChange}
          />
        </div>

        {/* ── Reduced motion ── */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--shop-cream)]">
              {t('prefs.reducedMotion')}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
              {t('prefs.reducedMotionHint')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reducedMotion}
            aria-label={t('settings.motionToggleAria')}
            onClick={handleMotionToggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-all duration-200 ${
              reducedMotion ? 'bg-[var(--shop-purple)]' : 'bg-white/15'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                reducedMotion ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <p className="mt-4 text-[11px] leading-5 text-zinc-500">
          {t('prefs.footerNote')}
        </p>
      </article>
    </>
  )
}
