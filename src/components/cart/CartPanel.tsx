import { useEffect, useState } from 'react'

import { animate, motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'

import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import { SwipeablePanel } from '../ui/SwipeablePanel'
import type { CartItem } from '../../types/cart'

type CartPanelProps = {
  items: CartItem[]
  onRemoveItem: (productId: string) => void
  onContinueShopping: () => void
  onProceedToCheckout: () => void
}

const DELETE_REVEAL_WIDTH = 100

export function CartPanel({
  items,
  onRemoveItem,
  onContinueShopping,
  onProceedToCheckout,
}: CartPanelProps) {
  const total = items.reduce((sum, item) => sum + item.price, 0)
  const [openItemId, setOpenItemId] = useState<string | null>(null)

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

  function closeOpenItem() {
    setOpenItemId(null)
  }

  return (
    <SwipeablePanel onDismiss={onContinueShopping} threshold={140}>
      <div className="animate-[fade-slide-in_0.4s_ease-out_backwards]">
        <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              Cart
            </p>
            <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-cream)]">
              {items.length} {items.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          <div className="relative mt-5 space-y-3">
            {/* ── Backdrop overlay when a card is open (tap anywhere to close) ── */}
            <AnimatePresence>
              {openItemId !== null && (
                <motion.div
                  key="swipe-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={closeOpenItem}
                  className="absolute inset-0 z-10"
                />
              )}
            </AnimatePresence>

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
                  YOUR BAG IS EMPTY
                </p>
                {/* Subtext */}
                <p className="animate-[fade-slide-in_0.4s_ease-out_backwards] mt-2 text-xs leading-relaxed text-zinc-500" style={{ animationDelay: '200ms' }}>
                  Looks like you haven&apos;t added any clothing pieces to your drop selection yet.
                </p>
              </div>
            ) : null}

            {items.map((item) => (
              <CartItemRow
                key={item.productId}
                item={item}
                isOpen={openItemId === item.productId}
                onOpen={() => setOpenItemId(item.productId)}
                onClose={() => setOpenItemId(null)}
                onRemove={onRemoveItem}
              />
            ))}
          </div>

          {/* ── Totals summary ── */}
          {items.length > 0 ? (
            <div className="mt-5 space-y-3 rounded-[24px] border border-white/10 bg-white/6 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Pieces
                </span>
                <span className="text-sm font-semibold text-[var(--shop-cream)]">{items.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Total
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
                <span>Checkout</span>
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

// ─── Cart Item Row (uses motion value hooks per item) ───

type CartItemRowProps = {
  item: CartItem
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onRemove: (productId: string) => void
}

function CartItemRow({
  item,
  isOpen,
  onOpen,
  onClose,
  onRemove,
}: CartItemRowProps) {
  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-0, -45, -90], [0, 0.5, 1])

  // Animate x position with spring when isOpen changes
  useEffect(() => {
    const controls = animate(x, isOpen ? -DELETE_REVEAL_WIDTH : 0, {
      type: 'spring',
      stiffness: 350,
      damping: 35,
      mass: 0.8,
    })
    return controls.stop
  }, [isOpen, x])

  return (
    <div className="relative overflow-hidden rounded-[24px]">
      {/* Hidden delete action — opacity mapped to drag x position via useTransform.
          At x=0  → opacity=0  (fully hidden — no red bleed-through on render)
          At x=-45 → opacity=0.5 (partially visible)
          At x=-100 → opacity=1.0 (fully revealed) */}
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute inset-y-0 right-0 flex w-[100px] items-center justify-center rounded-r-[24px] bg-[var(--shop-red)]/90"
      >
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('medium')
            onRemove(item.productId)
            onClose()
          }}
          className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-sm transition-colors active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 flex-shrink-0" aria-hidden="true">
          <g transform="translate(2, 2)">

            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c-.84 0-1.673.025-2.5.075V3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25v.325C11.673 4.025 10.84 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
          
          </g>
        </svg>
          Delete
        </button>
      </motion.div>

      {/* Draggable card — position tracked by useMotionValue for opacity mapping */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -DELETE_REVEAL_WIDTH, right: 0 }}
        dragElastic={0.08}
        style={{ x, touchAction: 'pan-y' }}
        onDragEnd={(_event, info) => {
          if (info.offset.x < -50 || info.velocity.x < -200) {
            onOpen()
          } else {
            onClose()
          }
        }}
        className="relative z-0 rounded-[24px]"
      >
        <div
          onClick={() => { if (isOpen) onClose() }}
          className="flex cursor-default items-center gap-3 rounded-[24px] border border-white/10 bg-white/6 p-3 select-none"
        >
          <div className="h-16 w-14 shrink-0 overflow-hidden rounded-2xl bg-black/20">
            {item.image ? (
              <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover pointer-events-none select-none" draggable={false} />
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
        </div>
      </motion.div>
    </div>
  )
}
