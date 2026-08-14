import { useEffect, useState } from 'react'

import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss'
import { SwipeablePanel } from '../ui/SwipeablePanel'
import { useI18n } from '../../lib/i18n'
import type { CartItem } from '../../types/cart'

type CartPanelProps = {
  items: CartItem[]
  onRemoveItem: (productId: string) => Promise<CartItem | null>
  onRestoreItem: (item: CartItem) => void
  onContinueShopping: () => void
  onProceedToCheckout: () => void
}

const DELETE_REVEAL_WIDTH = 100
const DELETE_SWIPE_THRESHOLD = 80
const UNDO_WINDOW_MS = 5000

export function CartPanel({
  items,
  onRemoveItem,
  onRestoreItem,
  onContinueShopping,
  onProceedToCheckout,
}: CartPanelProps) {
  const { t } = useI18n()
  const total = items.reduce((sum, item) => sum + item.price, 0)

  // ── Swipe-delete undo: keep the last removed item for UNDO_WINDOW_MS ──
  const [lastRemoved, setLastRemoved] = useState<CartItem | null>(null)

  useEffect(() => {
    if (!lastRemoved) return
    const timer = window.setTimeout(() => setLastRemoved(null), UNDO_WINDOW_MS)
    return () => window.clearTimeout(timer)
  }, [lastRemoved])

  async function handleRemove(item: CartItem) {
    const removed = await onRemoveItem(item.productId)
    if (removed) {
      setLastRemoved(removed)
    }
  }

  // Hide the native Telegram MainButton when cart is mounted
  useEffect(() => {
    try {
      window.Telegram?.WebApp?.MainButton?.hide()
    } catch {
      // Safe fallback outside Telegram
    }
  }, [])

  function handleCheckout() {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
    onProceedToCheckout()
  }

  return (
    <SwipeablePanel onDismiss={onContinueShopping} threshold={140}>
      <div className="animate-[fade-slide-in_0.4s_ease-out_backwards]">
        <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              {t('cart.title')}
            </p>
            <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-cream)]">
              {items.length} {items.length === 1 ? t('cart.itemOne') : t('cart.itemMany')}
            </span>
          </div>

          <div className="relative mt-5 space-y-3">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white/8 px-6 py-14 text-center">
                {/* Large muted shopping bag icon */}
                <div className="mb-5 flex h-14 w-14 animate-[float_3s_ease-in-out_infinite] items-center justify-center rounded-full border border-white/10 bg-white/6">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                    <path d="M3 6h18" />
                    <path d="M16 10a4 4 0 01-8 0" />
                  </svg>
                </div>
                {/* High-contrast title */}
                <p className="animate-[fade-slide-in_0.4s_ease-out_backwards] text-sm font-bold uppercase tracking-[0.2em] text-zinc-300" style={{ animationDelay: '100ms' }}>
                  {t('cart.emptyTitle')}
                </p>
                {/* Subtext */}
                <p className="animate-[fade-slide-in_0.4s_ease-out_backwards] mt-2 text-xs leading-relaxed text-zinc-500" style={{ animationDelay: '200ms' }}>
                  {t('cart.emptyBody')}
                </p>
              </div>
            ) : null}

            {items.map((item) => (
              <CartItemRow
                key={item.productId}
                item={item}
                onRemove={() => void handleRemove(item)}
              />
            ))}

            {/* Swipe hint */}
            {items.length > 0 ? (
              <p className="pt-1 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]/60">
                {t('cart.swipeHint')}
              </p>
            ) : null}

            {/* Undo pill — inline, above the totals so it never overlays the checkout button */}
            {lastRemoved ? (
              <div
                role="status"
                aria-live="polite"
                className="animate-[fade-slide-in_0.25s_ease-out] flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3"
              >
                <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                  {t('cart.removed')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('medium')
                    onRestoreItem(lastRemoved)
                    setLastRemoved(null)
                  }}
                  className="shrink-0 rounded-xl bg-[var(--shop-purple)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-colors active:scale-95"
                >
                  {t('cart.undo')}
                </button>
              </div>
            ) : null}
          </div>

          {/* ── Totals summary ── */}
          {items.length > 0 ? (
            <div className="mt-5 space-y-3 rounded-[24px] border border-white/10 bg-white/6 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  {t('cart.pieces')}
                </span>
                <span className="text-sm font-semibold text-[var(--shop-cream)]">{items.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  {t('cart.total')}
                </span>
                <span className="text-sm font-semibold text-[var(--shop-cream)]">{total} EUR</span>
              </div>
            </div>
          ) : null}

          {/* ── Checkout button ── */}
          {items.length > 0 ? (
            <div className="pb-4 pt-2">
              <button
                type="button"
                onClick={handleCheckout}
                className="flex w-full items-center justify-between rounded-[28px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-[0_8px_28px_rgba(139,61,255,0.3)] transition-all active:scale-[0.97]"
              >
                <span>{t('cart.checkout')}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">€{total}</span>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </span>
              </button>
            </div>
          ) : null}
          </article>
        </div>
      </SwipeablePanel>
  )
}

// ─── Cart Item Row (swipe left past threshold to delete) ───

type CartItemRowProps = {
  item: CartItem
  onRemove: () => void
}

function CartItemRow({ item, onRemove }: CartItemRowProps) {
  const { t } = useI18n()
  const reducedMotion = useReducedMotion()
  const [dragging, setDragging] = useState(false)

  // The x-axis swipe does not capture the pointer, so a gesture can end outside
  // this element — make sure the dragging flag (which disables the snap-back
  // transition) always gets cleared on release.
  useEffect(() => {
    function handleWindowPointerUp() {
      setDragging(false)
    }
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerUp)
    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerUp)
    }
  }, [])

  const { swipeDistance, handlers } = useSwipeToDismiss({
    axis: 'x',
    threshold: DELETE_SWIPE_THRESHOLD,
    onDismiss: () => {
      triggerHapticFeedback('medium')
      onRemove()
    },
  })

  // Red layer fades in as the row is pulled left; fully revealed at DELETE_REVEAL_WIDTH
  const deleteOpacity = Math.min(swipeDistance / DELETE_REVEAL_WIDTH, 1)
  // The delete button only becomes tappable once the red layer is actually
  // revealed — while hidden it must not intercept touches (it sits over the
  // right 100px of the row and would otherwise eat swipes and register taps).
  // Half the reveal width means the button is visibly out from under the card
  // before its full rect activates.
  const deleteButtonEnabled = swipeDistance >= DELETE_REVEAL_WIDTH / 2

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    setDragging(true)
    handlers.onPointerDown(event)
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    handlers.onPointerUp(event)
    setDragging(false)
  }

  function cancelDrag(event: React.PointerEvent<HTMLDivElement>) {
    handlers.onPointerCancel(event)
    setDragging(false)
  }

  return (
    <div className="relative overflow-hidden rounded-[24px]">
      {/* Hidden delete action — opacity mapped to swipe progress.
          Past DELETE_SWIPE_THRESHOLD the row removes itself on release.
          pointer-events-none lets touches fall through to the card until the
          row is actually dragged; only then does the Delete button activate. */}
      <div
        style={{ opacity: deleteOpacity }}
        className="pointer-events-none absolute inset-y-0 right-0 flex w-[100px] items-center justify-center rounded-r-[24px] bg-[var(--shop-red)]/90"
      >
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('medium')
            onRemove()
          }}
          className={`flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-sm transition-colors active:scale-95 ${
            deleteButtonEnabled ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 flex-shrink-0" aria-hidden="true">
          <g transform="translate(2, 2)">

            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c-.84 0-1.673.025-2.5.075V3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25v.325C11.673 4.025 10.84 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
          
          </g>
        </svg>
          {t('cart.delete')}
        </button>
      </div>

      {/* Draggable card — translateX driven by the swipe hook; snap-back on cancel */}
      <div
        onPointerDown={startDrag}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        className="relative z-0 rounded-[24px]"
        style={{
          transform: `translateX(${-swipeDistance}px)`,
          transition: dragging || reducedMotion
            ? 'none'
            : 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
          touchAction: 'pan-y',
        }}
      >
        <div className="flex cursor-default items-center gap-3 rounded-[24px] border border-white/10 bg-white/6 p-3 select-none">
          <div className="h-16 w-14 shrink-0 overflow-hidden rounded-2xl bg-black/20">
            {item.image ? (
              <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover pointer-events-none select-none" draggable={false} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                {t('cart.noImg')}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">{item.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              {item.price} {item.currency}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
