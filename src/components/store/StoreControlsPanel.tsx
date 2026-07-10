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
            ariaLabel="Catalog"
          >
            <GridIcon />
          </StoreNavButton>

          <StoreNavButton
            isActive={storeScreen === 'likes'}
            onClick={onOpenLikes}
            ariaLabel={`Liked pieces${likedCount > 0 ? ` (${likedCount})` : ''}`}
          >
            <HeartIcon filled={storeScreen === 'likes'} />
            {likedCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--shop-red)] text-[9px] font-bold leading-none text-white">
                {likedCount > 9 ? '9+' : likedCount}
              </span>
            ) : null}
          </StoreNavButton>

          <StoreNavButton
            isActive={storeScreen === 'orders'}
            onClick={onOpenOrders}
            ariaLabel="Orders"
          >
            <OrdersIcon />
          </StoreNavButton>

          <StoreNavButton
            isActive={
              storeScreen === 'cart' ||
              storeScreen === 'checkout' ||
              storeScreen === 'success'
            }
            onClick={onOpenCart}
            ariaLabel={`Cart${cartCount > 0 ? ` (${cartCount})` : ''}`}
          >
            <CartIcon />
            {cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--shop-red)] text-[9px] font-bold leading-none text-white">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            ) : null}
          </StoreNavButton>
        </div>
      </article>
    </>
  )
}

type StoreNavButtonProps = {
  isActive: boolean
  ariaLabel: string
  onClick: () => void
  children: React.ReactNode
}

function StoreNavButton({ isActive, ariaLabel, onClick, children }: StoreNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`relative flex items-center justify-center rounded-2xl py-3 transition-colors ${
        isActive
          ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
          : 'bg-white/6 text-[var(--shop-muted)]'
      }`}
    >
      {children}
    </button>
  )
}

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s-6.7-4.4-9.2-8.1C.8 10 .9 6.5 3.6 4.7c2.2-1.5 5.1-.8 6.8 1.3C12 3.9 14.8 3.2 17 4.7c2.7 1.8 2.8 5.3.8 8.2C18.7 14.2 12 21 12 21Z" />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4.5 2A2.5 2.5 0 002 4.5v11A2.5 2.5 0 004.5 18h11a2.5 2.5 0 002.5-2.5v-11A2.5 2.5 0 0015.5 2h-11zm.25 4a.75.75 0 000 1.5h10.5a.75.75 0 000-1.5H4.75zM4 9.5A.75.75 0 014.75 9h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 9.5zm0 3a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 014 12.5z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CartIcon() {
  return (
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
  )
}
