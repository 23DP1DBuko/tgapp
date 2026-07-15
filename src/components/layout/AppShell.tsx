import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Trophy } from 'lucide-react'

import { triggerHapticFeedback, triggerHapticNotification } from '../../lib/telegram/webApp'

type StoreScreen =
  | 'catalog'
  | 'product'
  | 'likes'
  | 'orders'
  | 'cart'
  | 'checkout'
  | 'success'
  | 'rewards'
  | 'polls'
  | 'privacy'
  | 'terms'
  | 'about'

type AppShellProps = {
  children: ReactNode
  title: string
  bottomNavVisible: boolean
  isModalOpen: boolean
  storeScreen: StoreScreen
  likedCount: number
  hasUnreadLikes: boolean
  cartCount: number
  onlineUsersCount: number
  showConsent: boolean | null
  onOpenCatalog: () => void
  onOpenLikes: () => void
  onOpenOrders: () => void
  onOpenCart: () => void
  onOpenRewards: () => void
  onOpenPrivacy: () => void
  onOpenTerms: () => void
  onOpenAbout: () => void
  onTripleTap: () => void
  onWithdrawConsent?: () => Promise<void>
}

export function AppShell({
  children,
  title,
  bottomNavVisible,
  isModalOpen,
  storeScreen,
  likedCount,
  hasUnreadLikes,
  cartCount,
  onlineUsersCount,
  showConsent,
  onOpenCatalog,
  onOpenLikes,
  onOpenOrders,
  onOpenCart,
  onOpenRewards,
  onOpenPrivacy,
  onOpenTerms,
  onOpenAbout,
  onTripleTap,
  onWithdrawConsent,
}: AppShellProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const tapTimestampsRef = useRef<number[]>([])
  const isConsentBlocked = showConsent === true || showWithdrawConfirm
  const isNavVisible = bottomNavVisible && !isConsentBlocked

  // Close settings dropdown on Escape
  useEffect(() => {
    if (!showSettings) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowSettings(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showSettings])

  const handleLogoClick = useCallback(() => {
    const now = Date.now()
    const recentTaps = tapTimestampsRef.current.filter((t) => now - t < 800)
    recentTaps.push(now)
    tapTimestampsRef.current = recentTaps

    if (recentTaps.length >= 3) {
      tapTimestampsRef.current = []
      triggerHapticFeedback('medium')
      onTripleTap()
    }
  }, [onTripleTap])

  return (
    <div className="min-h-screen text-[var(--shop-text)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-12 h-56 w-56 rounded-full bg-[var(--shop-purple)]/20 blur-3xl" />
        <div className="absolute right-[-18%] top-40 h-72 w-72 rounded-full bg-[var(--shop-red)]/15 blur-3xl" />
        <div className="absolute bottom-24 left-1/3 h-44 w-44 rounded-full bg-[var(--shop-magenta)]/20 blur-3xl" />
      </div>

      <div className={`mx-auto flex min-h-screen w-full max-w-md flex-col px-4 ${isNavVisible && !isModalOpen ? 'pb-24' : 'pb-4'} pt-4`}>
        <header className="mb-4 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={handleLogoClick}
            className="text-left outline-none"
            aria-label="YUNGWEAR (tap 3 times for admin)"
          >
            <h1 className="text-xl font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
              {title}
            </h1>
            {/* Online users count - animated */}
            {onlineUsersCount > 0 && (
              <p className="mt-0.5 text-[10px] font-semibold tracking-[0.12em] text-emerald-400/80 animate-pulse">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 align-middle" />
                online users: {onlineUsersCount}
              </p>
            )}
          </button>

          {/* Settings / Legal menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('light')
                setShowSettings((prev) => !prev)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-zinc-400 transition-colors hover:bg-white/10 hover:text-[var(--shop-cream)]"
              aria-label="Settings & Legal"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 flex-shrink-0" aria-hidden="true">
                <g transform="translate(2, 2)">
                  <path
                    fillRule="evenodd"
                    d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </g>
              </svg>
            </button>

            {/* Settings dropdown */}
            {showSettings && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSettings(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#1a0e1c] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false)
                      onOpenAbout()
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-300 transition-colors hover:bg-white/8"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true">
                      <g transform="translate(2, 2)">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </g>
                    </svg>
                    About & Contact
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false)
                      onOpenPrivacy()
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-300 transition-colors hover:bg-white/8"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true">
                      <g transform="translate(2, 2)">
                        <path
                          fillRule="evenodd"
                          d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </g>
                    </svg>
                    Privacy Policy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false)
                      onOpenTerms()
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-300 transition-colors hover:bg-white/8"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true">
                      <g transform="translate(2, 2)">
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                          clipRule="evenodd"
                        />
                      </g>
                    </svg>
                    Terms of Service
                  </button>

                  {/* Separator */}
                  <div className="mx-3 border-t border-white/8" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false)
                      setShowWithdrawConfirm(true)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--shop-red)] transition-colors hover:bg-[var(--shop-red)]/12"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
                      <g transform="translate(2, 2)">
                        <path
                          fillRule="evenodd"
                          d="M4.5 2A2.5 2.5 0 002 4.5v11A2.5 2.5 0 004.5 18h11a2.5 2.5 0 002.5-2.5v-11A2.5 2.5 0 0015.5 2h-11zm3.25 7.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z"
                          clipRule="evenodd"
                        />
                      </g>
                    </svg>
                    Revoke Consent
                  </button>
                </div>
              </>
            )}

            {/* ── Withdraw Consent Confirmation Dialog ── */}
            {showWithdrawConfirm && (
              <>
                <div
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                  onClick={() => setShowWithdrawConfirm(false)}
                  aria-hidden="true"
                />
                <div className="fixed inset-x-4 bottom-8 z-50 mx-auto max-w-md animate-[fade-slide-in_0.3s_ease-out]">
                  <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(28,14,34,0.98),rgba(18,10,24,0.98))] p-5 shadow-[0_-12px_48px_rgba(0,0,0,0.4)]">
                    {/* Handle bar */}
                    <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

                    {/* Warning icon */}
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--shop-red)]/20">
                      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-[var(--shop-red)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>

                    <h3 className="text-center text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
                      Revoke Consent
                    </h3>
                    <p className="mt-2 text-center text-sm leading-6 text-zinc-400">
                      This will withdraw your acceptance of the Privacy Policy and Terms of Service.
                      Your existing orders and data are not automatically deleted, but we will no longer
                      process new data based on consent. You can accept again at any time.
                    </p>

                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowWithdrawConfirm(false)}
                        disabled={isWithdrawing}
                        className="flex-1 rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)] transition-colors disabled:opacity-40"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!onWithdrawConsent || isWithdrawing) return
                          setIsWithdrawing(true)
                          try {
                            await onWithdrawConsent()
                            setShowWithdrawConfirm(false)
                            triggerHapticNotification('error')
                          } catch {
                            // Error handled in parent
                          } finally {
                            setIsWithdrawing(false)
                          }
                        }}
                        disabled={isWithdrawing}
                        className="flex-1 rounded-xl bg-[var(--shop-red)] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition-opacity disabled:opacity-50"
                      >
                        {isWithdrawing ? 'Revoking...' : 'Revoke'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>

      {/* Fixed bottom navigation — completely unmounted when consent is blocked or withdraw dialog is open */}
      {isNavVisible && !isModalOpen && (
        <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-3 pt-2">
        <div className="flex w-full max-w-md items-center justify-around rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(35,16,37,0.96),rgba(18,10,24,0.96))] px-2 py-2 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            <BottomNavButton
              isActive={storeScreen === 'catalog' || storeScreen === 'product' || storeScreen === 'likes'}
              onClick={() => {
                triggerHapticFeedback('light')
                onOpenCatalog()
              }}
              label="Browse"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 flex-shrink-0" aria-hidden="true">
                <g transform="translate(2, 2)">
                  <path
                    fillRule="evenodd"
                    d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z"
                    clipRule="evenodd"
                  />
                </g>
              </svg>
            </BottomNavButton>

            <BottomNavButton
              isActive={storeScreen === 'likes'}
              onClick={() => {
                triggerHapticFeedback('light')
                onOpenLikes()
              }}
              label="Liked"
              count={likedCount}
              badgeVariant={hasUnreadLikes ? 'brand' : 'muted'}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 flex-shrink-0"
                fill={storeScreen === 'likes' ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 21s-6.7-4.4-9.2-8.1C.8 10 .9 6.5 3.6 4.7c2.2-1.5 5.1-.8 6.8 1.3C12 3.9 14.8 3.2 17 4.7c2.7 1.8 2.8 5.3.8 8.2C18.7 14.2 12 21 12 21Z" />
              </svg>
            </BottomNavButton>

            <BottomNavButton
              isActive={storeScreen === 'rewards'}
              onClick={() => {
                triggerHapticFeedback('light')
                onOpenRewards()
              }}
              label="Rewards"
            >
              <Trophy
                className="w-5 h-5 flex-shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
            </BottomNavButton>

            <BottomNavButton
              isActive={storeScreen === 'orders'}
              onClick={() => {
                triggerHapticFeedback('light')
                onOpenOrders()
              }}
              label="Orders"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 flex-shrink-0" aria-hidden="true">
                <g transform="translate(2, 2)">
                  <path
                    fillRule="evenodd"
                    d="M4.5 2A2.5 2.5 0 002 4.5v11A2.5 2.5 0 004.5 18h11a2.5 2.5 0 002.5-2.5v-11A2.5 2.5 0 0015.5 2h-11zm.25 4a.75.75 0 000 1.5h10.5a.75.75 0 000-1.5H4.75zM4 9.5A.75.75 0 014.75 9h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 9.5zm0 3a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 014 12.5z"
                    clipRule="evenodd"
                  />
                </g>
              </svg>
            </BottomNavButton>

            <BottomNavButton
              isActive={storeScreen === 'cart' || storeScreen === 'checkout' || storeScreen === 'success'}
              onClick={() => {
                triggerHapticFeedback('light')
                onOpenCart()
              }}
              label="Cart"
              count={cartCount}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 7h10l-1.2 6H6.2L4.8 9.5" />
                <path d="M4 7 3 4H1.5" />
                <circle cx="7.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="13.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </BottomNavButton>
          </div>
        </nav>
      )}
    </div>
  )
}

type BottomNavButtonProps = {
  isActive: boolean
  onClick: () => void
  label: string
  count?: number
  badgeVariant?: 'brand' | 'muted'
  children: ReactNode
}

function BottomNavButton({
  isActive,
  onClick,
  label,
  count,
  badgeVariant = 'brand',
  children,
}: BottomNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 transition-colors ${
        isActive
          ? 'text-white'
          : 'text-[var(--shop-muted)]'
      }`}
      aria-label={`${label}${count != null && count > 0 ? ` (${count})` : ''}`}
    >
      {children}
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em]">
        {label}
      </span>
      {count != null && count > 0 ? (
        <span
          className={`absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white transition-colors duration-300 ${
            badgeVariant === 'brand'
              ? 'bg-[#E61E26]'
              : 'bg-zinc-700'
          }`}
        >
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </button>
  )
}
