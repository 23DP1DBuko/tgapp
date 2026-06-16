type StoreControlsPanelProps = {
  telegramGateMessage: string | null
  telegramBotLink: string
  storeScreen: 'catalog' | 'product' | 'likes' | 'orders' | 'cart' | 'checkout' | 'success'
  likedCount: number
  cartCount: number
  onCloseGate: () => void
  onOpenCatalog: () => void
  onOpenLikes: () => void
  onOpenOrders: () => void
  onOpenCart: () => void
}

export function StoreControlsPanel({
  telegramGateMessage,
  telegramBotLink,
  storeScreen,
  likedCount,
  cartCount,
  onCloseGate,
  onOpenCatalog,
  onOpenLikes,
  onOpenOrders,
  onOpenCart,
}: StoreControlsPanelProps) {
  return (
    <>
      {telegramGateMessage ? (
        <article className="rounded-[28px] border border-[var(--shop-red)]/20 bg-[var(--shop-red)]/12 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
                Open In Telegram
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
                {telegramGateMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseGate}
              className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
            >
              Close
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={telegramBotLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-[22px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white"
            >
              Open Telegram
            </a>
            <button
              type="button"
              onClick={onCloseGate}
              className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
            >
              Keep Browsing
            </button>
          </div>
        </article>
      ) : null}

      <article className="rounded-[28px] border border-white/10 bg-white/6 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-2">
          <StoreNavButton
            isActive={storeScreen === 'catalog' || storeScreen === 'product'}
            onClick={onOpenCatalog}
            label="Catalog"
          />
          <StoreNavButton
            isActive={storeScreen === 'likes'}
            onClick={onOpenLikes}
            label={`Likes ${likedCount}`}
          />
          <StoreNavButton
            isActive={storeScreen === 'orders'}
            onClick={onOpenOrders}
            label="Orders"
          />
          <StoreNavButton
            isActive={
              storeScreen === 'cart' ||
              storeScreen === 'checkout' ||
              storeScreen === 'success'
            }
            onClick={onOpenCart}
            label={`Cart ${cartCount}`}
          />
        </div>
      </article>
    </>
  )
}

type StoreNavButtonProps = {
  isActive: boolean
  label: string
  onClick: () => void
}

function StoreNavButton({ isActive, label, onClick }: StoreNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
        isActive
          ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
          : 'bg-white/6 text-[var(--shop-muted)]'
      }`}
    >
      {label}
    </button>
  )
}
