import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from 'recharts'

import type { Product } from '../../types/product'
import type { AnalyticsResult } from '../../lib/firebase/analytics'

type AdminDashboardPanelProps = {
  products: Product[]
  analytics?: AnalyticsResult | null
  soldCount: number
}

const CHART_PURPLE = '#8b3dff'
const CHART_MAGENTA = '#d91f6f'
const CHART_RED = '#ff4d5a'
const CHART_MUTED = 'rgba(255,255,255,0.12)'


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

  // ── Sparkline mock trend data (shows 7 data points simulating growth) ──
  const sparkData = useMemo(() => {
    // Distribute the current value across 7 days with realistic variation
    function buildSeries(current: number): { day: string; value: number }[] {
      const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
      const base = Math.max(1, Math.round(current * 0.3))
      return days.map((day, i) => ({
        day,
        value: Math.max(0, Math.round(base + (current - base) * (i / (days.length - 1)) + (Math.random() - 0.5) * base * 0.2)),
      }))
    }
    return {
      users: buildSeries(analyticsData.totalUsers),
      volume: buildSeries(analyticsData.itemsSold),
      revenue: buildSeries(Math.round(analyticsData.grossRevenueEur / 10)),
      referrals: buildSeries(analyticsData.referralCount),
    }
  }, [analyticsData])

  return (
    <div className="space-y-5">
      {/* ── METRICS ROW: 4 compact stat cards with mini bars ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Community"
          value={analyticsData.totalUsers.toLocaleString()}
          sublabel="Users"
          color={CHART_PURPLE}
          sparkData={sparkData.users}
          sparkColor={CHART_PURPLE}
        />
        <StatCard
          label="Volume"
          value={`${analyticsData.itemsSold}`}
          sublabel="Pieces Sold"
          color={CHART_MAGENTA}
          sparkData={sparkData.volume}
          sparkColor={CHART_MAGENTA}
        />
        <StatCard
          label="Revenue"
          value={formattedRevenue}
          sublabel="Gross"
          color="#10b981"
          sparkData={sparkData.revenue}
          sparkColor="#10b981"
        />
        <StatCard
          label="Referrals"
          value={analyticsData.referralCount.toLocaleString()}
          sublabel="Invites"
          color={CHART_RED}
          sparkData={sparkData.referrals}
          sparkColor={CHART_RED}
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
                  <XAxis
                    dataKey="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: CHART_MUTED, fontSize: 9, fontWeight: 600 }}
                    dy={6}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#1C1622] px-3 py-2 text-xs shadow-lg">
                          <p className="font-semibold text-[var(--shop-cream)]">{d.category}</p>
                          <p className="text-[var(--shop-muted)]">{d.count} item{d.count !== 1 ? 's' : ''}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {categoryData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i % 2 === 0 ? CHART_PURPLE : CHART_MAGENTA}
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
                    tick={{ fill: CHART_MUTED, fontSize: 10, fontWeight: 600 }}
                    width={70}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#1C1622] px-3 py-2 text-xs shadow-lg">
                          <p className="font-semibold text-[var(--shop-cream)]">{d.name}</p>
                          <p className="text-[var(--shop-muted)]">{d.value} item{d.value !== 1 ? 's' : ''}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {productStatusData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === 0 ? '#10b981' : CHART_RED}
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
                <XAxis
                  dataKey="metric"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: CHART_MUTED, fontSize: 9, fontWeight: 600 }}
                  dy={6}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="rounded-xl border border-white/10 bg-[#1C1622] px-3 py-2 text-xs shadow-lg">
                        <p className="font-semibold text-[var(--shop-cream)]">{d.metric}</p>
                        <p className="text-[var(--shop-muted)]">{d.value.toLocaleString()}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {metricsComparison.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? CHART_PURPLE : i === 1 ? CHART_MAGENTA : CHART_RED}
                      fillOpacity={0.8}
                    />
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

// ─── Stat Card (compact metric with colored accent) ───

type StatCardProps = {
  label: string
  value: string
  sublabel: string
  color: string
  sparkData?: { day: string; value: number }[]
  sparkColor?: string
}

function StatCard({ label, value, sublabel, color, sparkData, sparkColor }: StatCardProps) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#1C1622] px-4 py-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            {label}
          </p>
        </div>
        {/* Sparkline */}
        {sparkData && sparkData.length > 0 && (
          <div className="shrink-0">
            <ResponsiveContainer width={56} height={24}>
              <LineChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={sparkColor ?? color}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
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
    <article className="rounded-[24px] border border-white/10 bg-[#1C1622] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-2">
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
