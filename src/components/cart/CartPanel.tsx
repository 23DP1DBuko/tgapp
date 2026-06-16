import type { CartItem } from '../../types/cart'

type CartPanelProps = {
  items: CartItem[]
  onRemoveItem: (productId: string) => void
  onCheckout: () => void
  onContinueShopping: () => void
}

export function CartPanel({
  items,
  onRemoveItem,
  onCheckout,
  onContinueShopping,
}: CartPanelProps) {
  const total = items.reduce((sum, item) => sum + item.price, 0)
  const cartMoodCopy =
    items.length === 0
      ? 'Build your cart from the current drop and come back when a piece feels right.'
      : items.length === 1
        ? 'One piece is lined up and ready for the checkout step.'
        : `${items.length} pieces are lined up before checkout.`

  return (
    <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Cart
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
            Review the pieces you are holding before sending the checkout request.
          </p>
        </div>
        <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-cream)]">
          {items.length} Items
        </span>
      </div>

      <div className="mt-5 space-y-3">
        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.14),rgba(255,77,90,0.1))] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Cart Status
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--shop-cream)]">{cartMoodCopy}</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
              {items.length > 0 ? 'Ready' : 'Empty'}
            </span>
          </div>

          {items.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <CartSnapshotCard label="Pieces" value={`${items.length}`} hint="current hold" />
              <CartSnapshotCard label="Total" value={`${total} EUR`} hint="before promo" />
              <CartSnapshotCard label="Next" value="Checkout" hint="contact + payment" />
            </div>
          ) : null}
        </div>

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

      <div className="mt-5 rounded-[24px] border border-white/10 bg-white/6 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            Pieces
          </span>
          <span className="text-sm font-semibold text-[var(--shop-cream)]">
            {items.length}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            Total
          </span>
          <span className="text-sm font-semibold text-[var(--shop-cream)]">
            {total} EUR
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--shop-muted)]">
          Checkout will confirm fulfillment, payment, and final Telegram follow-up in the next step.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onContinueShopping}
          className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
        >
          Keep Browsing
        </button>
        <button
          type="button"
          onClick={onCheckout}
          disabled={items.length === 0}
          className="rounded-[24px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-55"
        >
          Checkout
        </button>
      </div>
    </article>
  )
}

type CartSnapshotCardProps = {
  label: string
  value: string
  hint: string
}

function CartSnapshotCard({ label, value, hint }: CartSnapshotCardProps) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/15 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--shop-cream)]">{value}</p>
      <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--shop-muted)]">
        {hint}
      </p>
    </div>
  )
}
