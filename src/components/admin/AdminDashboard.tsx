import { lazy, Suspense, useCallback, useMemo, useState } from 'react'

import { AdminDashboardPanel } from './AdminDashboardPanel'
import { AdminStatusPanel } from './AdminStatusPanel'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import type { AnalyticsResult } from '../../lib/firebase/analytics'
import type { Product } from '../../types/product'

const ProductAdminPanel = lazy(async () => {
  const module = await import('../product/ProductAdminPanel')
  return { default: module.ProductAdminPanel }
})

const OrderAdminPanel = lazy(async () => {
  const module = await import('../order/OrderAdminPanel')
  return { default: module.OrderAdminPanel }
})

const PromoAdminPanel = lazy(async () => {
  const module = await import('../promo/PromoAdminPanel')
  return { default: module.PromoAdminPanel }
})

const BroadcastAdminPanel = lazy(async () => {
  const module = await import('../broadcast/BroadcastAdminPanel')
  return { default: module.BroadcastAdminPanel }
})

const CampaignAdminPanel = lazy(async () => {
  const module = await import('../campaign/CampaignAdminPanel')
  return { default: module.CampaignAdminPanel }
})

const PollAdminPanel = lazy(async () => {
  const module = await import('../poll/PollAdminPanel')
  return { default: module.PollAdminPanel }
})

const RewardsAdminPanel = lazy(async () => {
  const module = await import('../rewards/RewardsAdminPanel')
  return { default: module.RewardsAdminPanel }
})

type TelegramUser = {
  id?: number
  username?: string
  first_name?: string
  last_name?: string
}

type AdminDashboardProps = {
  products: Product[]
  analytics?: AnalyticsResult
  initData: string
  isTelegram: boolean
  user: TelegramUser | undefined
  isAdminAccessLoading: boolean
  canManageProducts: boolean
  adminSubView: 'dashboard' | 'catalog' | 'growth' | 'orders' | 'rewards'
  onSelectSubView: (
    view: 'dashboard' | 'catalog' | 'growth' | 'orders' | 'rewards',
  ) => void
  onProductsChanged: () => void
}

type AdminTabDef = {
  key: 'dashboard' | 'catalog' | 'growth' | 'orders' | 'rewards'
  label: string
}

const ADMIN_TABS: AdminTabDef[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'catalog', label: 'Catalog' },
  { key: 'growth', label: 'Growth' },
  { key: 'orders', label: 'Orders' },
  { key: 'rewards', label: 'Rewards' },
]

const CATALOG_SUB_TABS = [
  { key: 'products', label: 'Products' },
  { key: 'promos', label: 'Promos' },
] as const

const GROWTH_SUB_TABS = [
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'broadcasts', label: 'Broadcasts' },
  { key: 'polls', label: 'Polls' },
] as const

export function AdminDashboard({
  products,
  analytics,
  initData,
  isTelegram,
  user,
  isAdminAccessLoading,
  canManageProducts,
  adminSubView,
  onSelectSubView,
  onProductsChanged,
}: AdminDashboardProps) {
  const soldCount = useMemo(
    () => products.filter((p) => !p.isAvailable).length,
    [products],
  )

  const [catalogSubTab, setCatalogSubTab] = useState<'products' | 'promos'>('products')
  const [growthSubTab, setGrowthSubTab] = useState<'campaigns' | 'broadcasts' | 'polls'>('campaigns')

  const handleTabSelect = useCallback(
    (tab: AdminTabDef['key']) => {
      triggerHapticFeedback('light')
      onSelectSubView(tab)
    },
    [onSelectSubView],
  )

  function renderActivePanel() {
    if (isAdminAccessLoading) {
      return (
        <article className="rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Admin Access
          </p>
          <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">
            Verifying Telegram admin access&hellip;
          </p>
        </article>
      )
    }

    if (!canManageProducts) {
      return (
        <article className="rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Admin Access
          </p>
          <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">
            Admin tools are restricted. Open the Mini App in Telegram with an authorized account.
          </p>
        </article>
      )
    }

    if (adminSubView === 'dashboard') {
      return (
        <AdminDashboardPanel
          products={products}
          analytics={analytics}
          soldCount={soldCount}
        />
      )
    }

    if (adminSubView === 'orders') {
      return (
        <Suspense fallback={<AdminPanelLoading label="Orders" />}>
          <OrderAdminPanel initData={initData} isEnabled={canManageProducts} />
        </Suspense>
      )
    }

    if (adminSubView === 'catalog') {
      return (
        <div className="space-y-4">
          <GroupTabStrip
            tabs={CATALOG_SUB_TABS}
            activeTab={catalogSubTab}
            onSelect={(key) => setCatalogSubTab(key as 'products' | 'promos')}
          />
          {catalogSubTab === 'products' ? (
            <Suspense fallback={<AdminPanelLoading label="Product Admin" />}>
              <ProductAdminPanel
                initData={initData}
                products={products}
                onProductsChanged={onProductsChanged}
              />
            </Suspense>
          ) : (
            <Suspense fallback={<AdminPanelLoading label="Promo Codes" />}>
              <PromoAdminPanel initData={initData} isEnabled={canManageProducts} />
            </Suspense>
          )}
        </div>
      )
    }

    if (adminSubView === 'growth') {
      return (
        <div className="space-y-4">
          <GroupTabStrip
            tabs={GROWTH_SUB_TABS}
            activeTab={growthSubTab}
            onSelect={(key) => setGrowthSubTab(key as 'campaigns' | 'broadcasts' | 'polls')}
          />
          {growthSubTab === 'campaigns' ? (
            <Suspense fallback={<AdminPanelLoading label="Campaigns" />}>
              <CampaignAdminPanel initData={initData} />
            </Suspense>
          ) : growthSubTab === 'broadcasts' ? (
            <Suspense fallback={<AdminPanelLoading label="Broadcasts" />}>
              <BroadcastAdminPanel initData={initData} />
            </Suspense>
          ) : (
            <Suspense fallback={<AdminPanelLoading label="Polls" />}>
              <PollAdminPanel initData={initData} />
            </Suspense>
          )}
        </div>
      )
    }

    if (adminSubView === 'rewards') {
      return (
        <Suspense fallback={<AdminPanelLoading label="Rewards Manager" />}>
          <RewardsAdminPanel initData={initData} />
        </Suspense>
      )
    }

    return null
  }

  return (
    <div className="pb-28">
      {/* ── Active Management Panel ── */}
      {renderActivePanel()}

      {/* ── Session Block ── */}
      <div className="mt-4">
        <AdminStatusPanel isTelegram={isTelegram} user={user} />
      </div>

      {/* ── Admin Bottom Navigation (only for verified admins) ── */}
      {canManageProducts ? (
        <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-3 pt-2">
          <div className="flex w-full max-w-md items-center justify-around rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(35,16,37,0.96),rgba(18,10,24,0.96))] px-2 py-2 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            {ADMIN_TABS.map((tab) => (
              <AdminNavButton
                key={tab.key}
                isActive={adminSubView === tab.key}
                onClick={() => handleTabSelect(tab.key)}
                label={tab.label}
                icon={tab.key}
              />
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  )
}

// ─── Group Sub-Tab Strip ───

type GroupTabStripProps = {
  tabs: readonly { readonly key: string; readonly label: string }[]
  activeTab: string
  onSelect: (key: string) => void
}

function GroupTabStrip({ tabs, activeTab, onSelect }: GroupTabStripProps) {
  return (
    <div className="flex gap-1.5 rounded-[20px] border border-white/10 bg-white/6 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => {
            triggerHapticFeedback('light')
            onSelect(tab.key)
          }}
          className={`flex-1 rounded-[14px] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition-all duration-200 ${
            activeTab === tab.key
              ? 'bg-[var(--shop-purple)] text-white shadow-[0_2px_8px_rgba(139,61,255,0.3)]'
              : 'text-[var(--shop-muted)] hover:text-[var(--shop-cream)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ─── Bottom Nav Button ───

type AdminNavButtonProps = {
  isActive: boolean
  onClick: () => void
  label: string
  icon: 'dashboard' | 'catalog' | 'growth' | 'orders' | 'rewards'
}

function AdminNavButton({ isActive, onClick, label, icon }: AdminNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 transition-colors ${
        isActive
          ? 'text-[var(--shop-purple)]'
          : 'text-[var(--shop-muted)]'
      }`}
      aria-label={label}
    >
      <span className="h-5 w-5">
        {icon === 'dashboard' ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 flex-shrink-0" aria-hidden="true">
            <g transform="translate(2, 2)">
              <path d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm1.5 0a6.5 6.5 0 1013 0 6.5 6.5 0 00-13 0z" />
              <path d="M10 5a.75.75 0 01.75.75v3.5l2.5 1.5a.75.75 0 01-.75 1.28l-3-1.8a.75.75 0 01-.375-.65V5.75A.75.75 0 0110 5z" />
            </g>
          </svg>
        ) : icon === 'catalog' ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 flex-shrink-0" aria-hidden="true">
            <g transform="translate(2, 2)">
              <path
                fillRule="evenodd"
                d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z"
                clipRule="evenodd"
              />
            </g>
          </svg>
        ) : icon === 'growth' ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 flex-shrink-0" aria-hidden="true">
            <g transform="translate(2, 2)">
              <path
                fillRule="evenodd"
                d="M1 11.25a.75.75 0 01.75-.75h2.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75h-2.5a.75.75 0 01-.75-.75v-7.5zm6-4a.75.75 0 01.75-.75h2.5a.75.75 0 01.75.75v11.5a.75.75 0 01-.75.75h-2.5a.75.75 0 01-.75-.75V7.25zm6-4a.75.75 0 01.75-.75h2.5a.75.75 0 01.75.75v15.5a.75.75 0 01-.75.75h-2.5a.75.75 0 01-.75-.75V3.25z"
                clipRule="evenodd"
              />
            </g>
          </svg>
        ) : icon === 'orders' ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 flex-shrink-0" aria-hidden="true">
            <g transform="translate(2, 2)">
              <path
                fillRule="evenodd"
                d="M4.5 2A2.5 2.5 0 002 4.5v11A2.5 2.5 0 004.5 18h11a2.5 2.5 0 002.5-2.5v-11A2.5 2.5 0 0015.5 2h-11zm.25 4a.75.75 0 000 1.5h10.5a.75.75 0 000-1.5H4.75zM4 9.5A.75.75 0 014.75 9h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 9.5zm0 3a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 014 12.5z"
                clipRule="evenodd"
              />
            </g>
          </svg>
        ) : icon === 'rewards' ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 flex-shrink-0" aria-hidden="true">
            <g transform="translate(2, 2)">
              <path d="M9 1a2 2 0 00-2 2v.17l-2.97.89A1.5 1.5 0 003 5.5v9.17A1.5 1.5 0 004.03 16L7 15.08V18h6v-2.92l2.97.89A1.5 1.5 0 0017 14.67V5.5a1.5 1.5 0 00-1.03-1.44L13 3.17V3a2 2 0 00-2-2H9zm2 2.35V3a.5.5 0 00-.5-.5h-1A.5.5 0 009 3v.35l2 .7zM7 4.5v7l-2.5.74V5.24L7 4.5zm6 0v7l2.5.74V5.24L13 4.5zM7 13.12v2l-2.5.74v-2L7 13.12zm6 0v2l2.5.74v-2L13 13.12z" />
            </g>
          </svg>
        ) : null}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em]">
        {label}
      </span>
    </button>
  )
}

function AdminPanelLoading({ label }: { label: string }) {
  return (
    <article className="mt-4 rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
        {label}
      </p>
      <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">
        Loading this panel&hellip;
      </p>
    </article>
  )
}
