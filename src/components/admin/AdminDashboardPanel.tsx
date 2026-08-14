import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

import type { Product } from '../../types/product'
import type { AnalyticsResult } from '../../lib/firebase/analytics'

type AdminDashboardPanelProps = {
  products: Product[]
  analytics?: AnalyticsResult | null
  soldCount: number
}

// Chart palette mirrors the design tokens in index.css (--shop-*) so the
// dashboard stays on-brand and follows any future token changes.
const CHART_PURPLE = '#8b3dff'
const CHART_MAGENTA = '#d91f6f'
const CHART_RED = '#ff4d5a'
const CHART_EMERALD = '#10b981' // --shop-emerald (success / revenue)
const CHART_TICK = 'rgba(212,184,207,0.65)' // --shop-muted at reduced alpha
const CHART_GRID = 'rgba(255,255,255,0.06)'


export function AdminDashboardPanel({
  products,
  analytics,
  soldCount,
}: AdminDashboardPanelProps) {
  // Stable fallback so derived useMemos don't re-run on every render when
  // analytics is still loading (analytics ?? {...} would mint a new object).
  const analyticsData = useMemo(
    () => analytics ?? {
      totalUsers: 0,
      itemsSold: soldCount,
      grossRevenueEur: 0,
      referralCount: 0,
    },
    [analytics, soldCount],
  )

  const formattedRevenue = useMemo(() => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(analyticsData.grossRevenueEur)
  }, [analyticsData.grossRevenueEur])

  const totalOrders = analyticsData.itemsSold

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

  // ── Top products by heat score (likes + cartCount*2) ──
  const topProducts = useMemo(() => {
    return [...products]
      .map((p) => ({
        name: p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name,
        likes: p.likesCount ?? 0,
        cartCount: p.cartCount ?? 0,
        heatScore: (p.likesCount ?? 0) + (p.cartCount ?? 0) * 2,
        price: p.price,
        isAvailable: p.isAvailable,
      }))
      .sort((a, b) => b.heatScore - a.heatScore)
      .slice(0, 5)
  }, [products])

  // ── Category distribution ──
  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    products.forEach((p) => {
      map.set(p.category, (map.get(p.category) ?? 0) + 1)
    })
    return Array.from(map.entries()).map(([category, count]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      count,
    }))
  }, [products])

  // ── Key metrics comparison ──
  const metricsComparison = useMemo(() => {
    const maxVal = Math.max(
      analyticsData.totalUsers,
      analyticsData.itemsSold,
      analyticsData.referralCount,
      1,
    )
    return [
      { metric: 'Users', value: analyticsData.totalUsers, pct: (analyticsData.totalUsers / maxVal) * 100 },
      { metric: 'Sold', value: analyticsData.itemsSold, pct: (analyticsData.itemsSold / maxVal) * 100 },
      { metric: 'Referrals', value: analyticsData.referralCount, pct: (analyticsData.referralCount / maxVal) * 100 },
    ]
  }, [analyticsData])

  const productStatusData = useMemo(() => {
    const available = products.filter((p) => p.isAvailable).length
    const sold = products.length - available
    return [
      { name: 'Available', value: available },
      { name: 'Sold', value: sold },
    ]
  }, [products])

  const maxHeat = topProducts.length > 0 ? Math.max(...topProducts.map((p) => p.heatScore), 1) : 1

  return (
    <div className="space-y-5">
      {/* ── METRICS ROW: 4 compact stat cards with mini bars ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Community"
          value={analyticsData.totalUsers.toLocaleString()}
          sublabel="Users"
          color={CHART_PURPLE}
        />
        <StatCard
          label="Volume"
          value={`${analyticsData.itemsSold}`}
          sublabel="Pieces Sold"
          color={CHART_MAGENTA}
        />
        <StatCard
          label="Revenue"
          value={formattedRevenue}
          sublabel="Gross"
          color={CHART_EMERALD}
        />
        <StatCard
          label="Referrals"
          value={analyticsData.referralCount.toLocaleString()}
          sublabel="Invites"
          color={CHART_RED}
        />
      </div>

      {/* ── CHARTS GRID ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* CHART 1: Top Products by Heat Score (horizontal bar) */}
        <ChartCard title="Most Wanted" subtitle="By likes + cart activity">
          {topProducts.length > 0 ? (
            <div className="mt-2 space-y-2.5">
              {topProducts.map((p) => {
                const pct = (p.heatScore / maxHeat) * 100
                return (
                  <div key={p.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-[var(--shop-cream)] font-medium">
                        {p.name}
                      </span>
                      <span className="shrink-0 ml-2 text-[var(--shop-muted)]">
                        {p.heatScore}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${CHART_PURPLE}, ${CHART_MAGENTA})`,
                        }}
                      />
                    </div>
                    <div className="flex gap-3 text-[9px] text-[var(--shop-muted)]/60">
                      <span>♥ {p.likes}</span>
                      <span>🛒 {p.cartCount}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--shop-muted)]/60">No products yet</p>
          )}
        </ChartCard>

        {/* CHART 2: Category Distribution (bar chart) */}
        <ChartCard title="Catalog" subtitle="Items per category">
          {categoryData.length > 0 ? (
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={categoryData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="catGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_MAGENTA} stopOpacity={1} />
                      <stop offset="100%" stopColor={CHART_PURPLE} stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={CHART_GRID} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: CHART_TICK, fontSize: 9, fontWeight: 600 }}
                    dy={6}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    isAnimationActive={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <TooltipShell
                          label={d.category}
                          value={`${d.count} item${d.count !== 1 ? 's' : ''}`}
                          color={CHART_MAGENTA}
                        />
                      )
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill="url(#catGrad)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--shop-muted)]/60">No products yet</p>
          )}
        </ChartCard>

        {/* CHART 3: Product Status (Available vs Sold) */}
        <ChartCard title="Stock Status" subtitle="Available vs Sold">
          {productStatusData.length > 0 && products.length > 0 ? (
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart
                  data={productStatusData}
                  layout="vertical"
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: CHART_TICK, fontSize: 10, fontWeight: 600 }}
                    width={70}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    isAnimationActive={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <TooltipShell
                          label={d.name}
                          value={`${d.value} item${d.value !== 1 ? 's' : ''}`}
                          color={payload[0].color}
                        />
                      )
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false}>
                    {productStatusData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === 0 ? CHART_EMERALD : CHART_RED}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--shop-muted)]/60">No products yet</p>
          )}
        </ChartCard>

        {/* CHART 4: Key Metrics Comparison (bar chart) */}
        <ChartCard title="Metrics Overview" subtitle="Users · Sold · Referrals">
          <div className="mt-2">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={metricsComparison} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_RED} stopOpacity={1} />
                    <stop offset="100%" stopColor={CHART_PURPLE} stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={CHART_GRID} strokeDasharray="3 3" />
                <XAxis
                  dataKey="metric"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: CHART_TICK, fontSize: 9, fontWeight: 600 }}
                  dy={6}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <TooltipShell
                        label={d.metric}
                        value={d.value.toLocaleString()}
                        color={CHART_PURPLE}
                      />
                    )
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                  {metricsComparison.map((_, i) => (
                    <Cell key={i} fill="url(#metricGrad)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* ── BUSINESS INSIGHTS BOTTOM ROW ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <InsightCard
          label="Avg Order Value"
          value={formattedAov}
          subtext="Per transaction"
        />
        <InsightCard
          label="Checkout Rate"
          value={`${conversionRate}%`}
          subtext={`${totalOrders} orders`}
        />
        <InsightCard
          label="Heat Leader"
          value={topProducts[0]?.name ?? '—'}
          subtext={topProducts[0] ? `${topProducts[0].heatScore} pts` : 'No data'}
          span={topProducts[0] && topProducts[0].name.length > 15 ? 'col-span-2 sm:col-span-1' : ''}
        />
      </div>
    </div>
  )
}

// ─── Branded chart tooltip shell ───

type TooltipShellProps = {
  label: string
  value: string
  color?: string
}

function TooltipShell({ label, value, color }: TooltipShellProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[rgba(24,12,26,0.92)] px-3 py-2 text-xs shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <p className="flex items-center gap-1.5 font-semibold uppercase tracking-[0.14em] text-[var(--shop-cream)]">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color ?? CHART_PURPLE }}
        />
        {label}
      </p>
      <p className="mt-1 text-[var(--shop-muted)]">{value}</p>
    </div>
  )
}

// ─── Stat Card (compact metric with colored accent) ───

type StatCardProps = {
  label: string
  value: string
  sublabel: string
  color: string
}

function StatCard({ label, value, sublabel, color }: StatCardProps) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[var(--shop-panel-solid)] px-4 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
          {label}
        </p>
      </div>
      <p className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--shop-muted)]/60">
        {sublabel}
      </p>
    </div>
  )
}

// ─── Chart Card (wraps charts with a title) ───

type ChartCardProps = {
  title: string
  subtitle: string
  children: React.ReactNode
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-[var(--shop-panel-solid)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-1 shrink-0 rounded-full bg-[linear-gradient(180deg,var(--shop-magenta),var(--shop-purple))]" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
          {title}
        </p>
        <span className="text-[8px] text-[var(--shop-muted)]/40 tracking-[0.12em]">
          {subtitle}
        </span>
      </div>
      {children}
    </article>
  )
}

// ─── Insight Card (bottom row) ───

type InsightCardProps = {
  label: string
  value: string
  subtext: string
  span?: string
}

function InsightCard({ label, value, subtext, span = '' }: InsightCardProps) {
  return (
    <div className={`rounded-[22px] border border-white/10 bg-[var(--shop-panel)] px-4 py-4 ${span}`}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
        {label}
      </p>
      <p className="mt-1.5 text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)] truncate">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--shop-muted)]/60">
        {subtext}
      </p>
    </div>
  )
}
