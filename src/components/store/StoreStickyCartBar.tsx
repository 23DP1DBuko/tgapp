type StoreStickyCartBarProps = {
  itemCount: number
  total: number
  onOpenCart: () => void
}

export function StoreStickyCartBar({
  itemCount,
  total,
  onOpenCart,
}: StoreStickyCartBarProps) {
  if (itemCount === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <article className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(35,16,37,0.96),rgba(18,10,24,0.96))] px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
            Cart Ready
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--shop-cream)]">
            {itemCount} {itemCount === 1 ? 'piece' : 'pieces'} · {total} EUR
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCart}
          className="shrink-0 rounded-[22px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white"
        >
          Open Cart
        </button>
      </article>
    </div>
  )
}
