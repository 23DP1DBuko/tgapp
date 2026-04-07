import type { CartItem } from '../../types/cart'

type CartPanelProps = {
  items: CartItem[]
  onRemoveItem: (productId: string) => void
  onCheckout: () => void
}

export function CartPanel({ items, onRemoveItem, onCheckout }: CartPanelProps) {
  const total = items.reduce((sum, item) => sum + item.price, 0)

  return (
    <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Cart
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
            One piece per item. This cart stays client-side for now.
          </p>
        </div>
        <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-cream)]">
          {items.length} Items
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
            Your cart is empty. Add a piece from the selected drop view.
          </p>
        ) : null}

        {items.map((item) => (
          <div
            key={item.productId}
            className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/6 p-3"
          >
            <div className="h-16 w-14 shrink-0 overflow-hidden rounded-2xl bg-black/20">
              {item.image ? (
                <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                  No Img
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">{item.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                {item.price} {item.currency}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onRemoveItem(item.productId)}
              className="rounded-full bg-[var(--shop-red)]/18 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-[24px] border border-white/10 bg-white/6 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
          Total
        </span>
        <span className="text-sm font-semibold text-[var(--shop-cream)]">
          {total} EUR
        </span>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={items.length === 0}
        className="mt-4 w-full rounded-[24px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-55"
      >
        Proceed To Checkout
      </button>
    </article>
  )
}
