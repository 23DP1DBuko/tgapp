import { useMemo } from 'react'

import type { Product } from '../../types/product'
import type { AnalyticsResult } from '../../lib/firebase/analytics'

type AdminDashboardPanelProps = {
  products: Product[]
  analytics?: AnalyticsResult | null
  soldCount: number
}

export function AdminDashboardPanel({
  products,
  analytics,
  soldCount,
}: AdminDashboardPanelProps) {
  const analyticsData = analytics ?? {
    totalUsers: 0,
    itemsSold: soldCount,
    grossRevenueEur: 0,
    referralCount: 0,
  }

  const formattedRevenue = useMemo(() => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(analyticsData.grossRevenueEur)
  }, [analyticsData.grossRevenueEur])

  // ── Derived business insights ──

  const totalOrders = useMemo(() => analyticsData.itemsSold, [analyticsData.itemsSold])

  const averageOrderValue = useMemo(() => {
    if (totalOrders === 0) return 0
    return analyticsData.grossRevenueEur / totalOrders
  }, [analyticsData.grossRevenueEur, totalOrders])

  const formattedAov = useMemo(() => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(averageOrderValue)
  }, [averageOrderValue])

  const conversionRate = useMemo(() => {
    if (analyticsData.totalUsers === 0) return '0'
    const rate = (totalOrders / analyticsData.totalUsers) * 100
    return rate < 1 ? rate.toFixed(2) : rate.toFixed(1)
  }, [analyticsData.totalUsers, totalOrders])

  const mostWantedProduct = useMemo(() => {
    if (products.length === 0) return null
    return products.reduce((best, product) => {
      const score = (product.likesCount ?? 0) + (product.cartCount ?? 0) * 2
      const bestScore = (best.likesCount ?? 0) + (best.cartCount ?? 0) * 2
      return score > bestScore ? product : best
    })
  }, [products])

  return (
    <div className="space-y-5">
      {/* ── 2×2 Analytics Grid ── */}
      <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(28,14,34,0.96),rgba(18,10,22,0.98))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
        <div className="grid grid-cols-2 gap-3">
          {/* CARD 1: COMMUNITY — total users + live pulse */}
          <AnalyticsCard
            label="Community"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M10 1a6 6 0 00-6 6c0 1.5.55 2.88 1.46 3.93L4.3 13.3a.75.75 0 00.53 1.2h10.34a.75.75 0 00.53-1.2l-1.16-2.37A5.99 5.99 0 0016 7a6 6 0 00-6-6z" />
              </svg>
            }
          >
            <p className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
              {analyticsData.totalUsers.toLocaleString()}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-100/70">
                Live Users
              </span>
            </div>
          </AnalyticsCard>

          {/* CARD 2: VOLUME — items sold */}
          <AnalyticsCard
            label="Volume"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M3 6a3 3 0 013-3h8a3 3 0 013 3v1.5a.5.5 0 01-.5.5h-11A1.5 1.5 0 003 6z" />
                <path d="M3 9.5v4A1.5 1.5 0 004.5 15h11a1.5 1.5 0 001.5-1.5V9.5H3z" />
              </svg>
            }
          >
            <p className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
              {analyticsData.itemsSold} <span className="text-xs font-semibold text-[var(--shop-muted)]">Pieces</span>
            </p>
          </AnalyticsCard>

          {/* CARD 3: FINANCES — gross revenue in EUR */}
          <AnalyticsCard
            label="Gross Revenue"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M10 1a6 6 0 00-6 6c0 1.5.55 2.88 1.46 3.93L4.3 13.3a.75.75 0 00.53 1.2h10.34a.75.75 0 00.53-1.2l-1.16-2.37A5.99 5.99 0 0016 7a6 6 0 00-6-6zm4.5 7.5h-9A.75.75 0 014.5 9h11a.75.75 0 010 1.5h-9A.75.75 0 016 7.5h8.5z" />
              </svg>
            }
          >
            <p className="text-lg font-extrabold tracking-[-0.03em] text-white">
              {formattedRevenue}
            </p>
          </AnalyticsCard>

          {/* CARD 4: REFERRALS — invite-based signups */}
          <AnalyticsCard
            label="Referrals"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
                <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
              </svg>
            }
          >
            <p className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
              {analyticsData.referralCount.toLocaleString()}
            </p>
          </AnalyticsCard>
        </div>
      </article>

      {/* ── BUSINESS INSIGHTS ── */}
      <article className="rounded-[28px] border border-white/10 bg-[#1C1622] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
        <div className="mb-3 flex items-center gap-2 px-1">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--shop-purple)]" aria-hidden="true">
            <path d="M10 .5a9.5 9.5 0 100 19 9.5 9.5 0 000-19zm.75 5.25a.75.75 0 00-1.5 0v4.5a.75.75 0 00.316.612l3.5 2.25a.75.75 0 10.868-1.224l-3.184-2.047V5.75z" />
          </svg>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            Business Insights
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* CARD 5: CONVERSION & TICKETS — AOV + conversion rate */}
          <div className="col-span-2 flex flex-col gap-2 rounded-[22px] border border-white/10 bg-[var(--shop-panel)] px-4 py-4 sm:col-span-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-[var(--shop-muted)]">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" />
                </svg>
              </span>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
                Conversion &amp; Tickets
              </p>
            </div>
            <div className="flex items-baseline gap-4">
              <div>
                <p className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
                  {formattedAov}
                </p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]/60">
                  Avg Order Value
                </p>
              </div>
              <div>
                <p className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
                  {conversionRate}%
                </p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]/60">
                  Checkout Rate
                </p>
              </div>
            </div>
          </div>

          {/* CARD 6: MOST WANTED — top trending product */}
          <div className="flex flex-col gap-2 rounded-[22px] border border-white/10 bg-[var(--shop-panel)] px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-[var(--shop-muted)]">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M13.5 4.938a7 7 0 11-9.006 1.737c.202-.257.59-.218.793.039.278.352.594.672.943.954.332.269.786-.049.773-.476a5.977 5.977 0 01.572-2.759 6.02 6.02 0 012.286-2.624c.248-.162.543-.023.565.222.042.446.164.883.363 1.285.348.702.855 1.29 1.482 1.697.626.407 1.35.63 2.105.635.1.006.225-.006.31-.066a.485.485 0 00.145-.38 6.055 6.055 0 01.422-2.448 6.1 6.1 0 01.932-1.601c.18-.228.525-.13.596.126a6.944 6.944 0 01.466 2.368z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
                Most Wanted
              </p>
            </div>
            {mostWantedProduct ? (
              <>
                <p className="line-clamp-2 text-sm font-bold tracking-[-0.02em] text-[var(--shop-cream)]">
                  {mostWantedProduct.name}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-[var(--shop-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-[var(--shop-red)]" aria-hidden="true">
                      <path d="M8 1a4 4 0 00-4 4c0 1.5.55 2.88 1.46 3.93L4.3 13.3a.75.75 0 00.53 1.2h6.34a.75.75 0 00.53-1.2l-1.16-2.37A3.99 3.99 0 0012 5a4 4 0 00-4-4z" />
                    </svg>
                    {mostWantedProduct.likesCount ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-[var(--shop-purple)]" aria-hidden="true">
                      <path d="M2 4h12l-1.2 6H3.2L2 4z" />
                      <circle cx="6" cy="13" r="1" fill="currentColor" stroke="none" />
                      <circle cx="11" cy="13" r="1" fill="currentColor" stroke="none" />
                    </svg>
                    {mostWantedProduct.cartCount ?? 0}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-[var(--shop-muted)]/60">
                No products yet
              </p>
            )}
          </div>

          {/* CARD 7: VIRAL ACTIVITY — daily completed social tasks */}
          <div className="flex flex-col gap-2 rounded-[22px] border border-white/10 bg-[var(--shop-panel)] px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-[var(--shop-muted)]">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M9 1a2 2 0 00-2 2v.17l-2.97.89A1.5 1.5 0 003 5.5v9.17A1.5 1.5 0 004.03 16L7 15.08V18h6v-2.92l2.97.89A1.5 1.5 0 0017 14.67V5.5a1.5 1.5 0 00-1.03-1.44L13 3.17V3a2 2 0 00-2-2H9zm2 2.35V3a.5.5 0 00-.5-.5h-1A.5.5 0 009 3v.35l2 .7zM7 4.5v7l-2.5.74V5.24L7 4.5zm6 0v7l2.5.74V5.24L13 4.5zM7 13.12v2l-2.5.74v-2L7 13.12zm6 0v2l2.5.74v-2L13 13.12z" />
                </svg>
              </span>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
                Viral Activity
              </p>
            </div>
            <p className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
              {analyticsData.referralCount} <span className="text-xs font-semibold text-[var(--shop-muted)]">Tasks Done</span>
            </p>
            <p className="text-[10px] text-[var(--shop-muted)]/60">
              Lifetime referral actions
            </p>
          </div>
        </div>
      </article>
    </div>
  )
}

/* ─── Reusable Analytics Card ─── */

type AnalyticsCardProps = {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}

function AnalyticsCard({ label, icon, children }: AnalyticsCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-[22px] border border-white/10 bg-[#1C1622] px-4 py-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-[var(--shop-muted)]">
          {icon}
        </span>
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
          {label}
        </p>
      </div>
      <div>{children}</div>
    </div>
  )
}
