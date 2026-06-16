type AdminOverviewPanelProps = {
  productCount: number
  availableCount: number
  soldCount: number
  onOpenProducts: () => void
  onOpenPromos: () => void
  onOpenOrders: () => void
  onOpenBroadcasts: () => void; 
}

export function AdminOverviewPanel({
  productCount,
  availableCount,
  soldCount,
  onOpenProducts,
  onOpenPromos,
  onOpenOrders,
  onOpenBroadcasts,
}: AdminOverviewPanelProps) {
  console.log('INIT_DATA', window.Telegram?.WebApp?.initData)
  return (
    <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
        Admin Overview
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
        Quick entry point for the control room. Use it to jump into the part of the app you want to manage next.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <AdminStat label="Products" value={String(productCount)} />
        <AdminStat label="Available" value={String(availableCount)} />
        <AdminStat label="Sold" value={String(soldCount)} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={onOpenProducts}
          className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-left"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
            Products
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
            Manage product content, gallery order, availability, and cleanup.
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenPromos}
          className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-left"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
            Promos
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
            Create, disable, and clean up promo codes for the next drop.
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenOrders}
          className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-left"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
            Orders
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
            Review checkout requests, copy payment notes, and move order statuses forward.
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenBroadcasts}
          className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-left"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
            Broadcasts
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
            Manage and review broadcast messages sent to Telegram subscribers.
          </p>
        </button>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/10 bg-white/6 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
          Release Checkpoint
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
          When you want to push the current version to the linked Telegram Mini App, build and deploy Hosting plus the Firebase rules that back products, orders, and images.
        </p>
        <div className="mt-3 rounded-2xl bg-black/20 px-4 py-3 text-xs leading-6 text-[var(--shop-cream)]">
          <code>npm.cmd run build</code>
          <br />
          <code>npx.cmd firebase-tools deploy --only hosting,firestore:rules,storage</code>
        </div>
      </div>
    </article>
  )
}

type AdminStatProps = {
  label: string
  value: string
}

function AdminStat({ label, value }: AdminStatProps) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/6 px-3 py-4 backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
        {value}
      </p>
    </div>
  )
}
