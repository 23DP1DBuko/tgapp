import { useRef, useCallback } from 'react'
import type { ReactNode } from 'react'

import { triggerHapticFeedback } from '../../lib/telegram/webApp'

type StoreScreen =
  | 'catalog'
  | 'product'
  | 'likes'
  | 'orders'
  | 'cart'
  | 'checkout'
  | 'success'
  | 'rewards'

type AppShellProps = {
  children: ReactNode
  title: string
  bottomNavVisible: boolean
  storeScreen: StoreScreen
  likedCount: number
  cartCount: number
  onOpenCatalog: () => void
  onOpenLikes: () => void
  onOpenOrders: () => void
  onOpenCart: () => void
  onOpenRewards: () => void
  onTripleTap: () => void
}

export function AppShell({
  children,
  title,
  bottomNavVisible,
  storeScreen,
  likedCount,
  cartCount,
  onOpenCatalog,
  onOpenLikes,
  onOpenOrders,
  onOpenCart,
  onOpenRewards,
  onTripleTap,
}: AppShellProps) {
  const tapTimestampsRef = useRef<number[]>([])
  const isNavVisible = bottomNavVisible

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

      <div className={`mx-auto flex min-h-screen w-full max-w-md flex-col px-4 ${isNavVisible ? 'pb-24' : 'pb-4'} pt-4`}>
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
          </button>
        </header>

        <main className="flex-1">{children}</main>
      </div>

      {/* Fixed bottom navigation */}
      {isNavVisible ? (
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
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z"
                  clipRule="evenodd"
                />
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
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
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
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M9 1a2 2 0 00-2 2v.17l-2.97.89A1.5 1.5 0 003 5.5v9.17A1.5 1.5 0 004.03 16L7 15.08V18h6v-2.92l2.97.89A1.5 1.5 0 0017 14.67V5.5a1.5 1.5 0 00-1.03-1.44L13 3.17V3a2 2 0 00-2-2H9zm2 2.35V3a.5.5 0 00-.5-.5h-1A.5.5 0 009 3v.35l2 .7zM7 4.5v7l-2.5.74V5.24L7 4.5zm6 0v7l2.5.74V5.24L13 4.5zM7 13.12v2l-2.5.74v-2L7 13.12zm6 0v2l2.5.74v-2L13 13.12z" />
              </svg>
            </BottomNavButton>

            <BottomNavButton
              isActive={storeScreen === 'orders'}
              onClick={() => {
                triggerHapticFeedback('light')
                onOpenOrders()
              }}
              label="Orders"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M4.5 2A2.5 2.5 0 002 4.5v11A2.5 2.5 0 004.5 18h11a2.5 2.5 0 002.5-2.5v-11A2.5 2.5 0 0015.5 2h-11zm.25 4a.75.75 0 000 1.5h10.5a.75.75 0 000-1.5H4.75zM4 9.5A.75.75 0 014.75 9h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 9.5zm0 3a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 014 12.5z"
                  clipRule="evenodd"
                />
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
                className="h-5 w-5"
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
      ) : null}
    </div>
  )
}

type BottomNavButtonProps = {
  isActive: boolean
  onClick: () => void
  label: string
  count?: number
  children: ReactNode
}

function BottomNavButton({
  isActive,
  onClick,
  label,
  count,
  children,
}: BottomNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-3 py-2 transition-colors ${
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
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--shop-red)] text-[9px] font-bold leading-none text-white">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </button>
  )
}
