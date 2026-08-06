import { useEffect, useCallback, useRef } from 'react'

import { motion, useMotionValue } from 'motion/react'

/**
 * HoldToCancelButton
 *
 * Two visual states:
 * - isInCart=false → Standard "ADD TO CART" gradient CTA (click to add)
 * - isInCart=true  → Dark "IN CART" button with hold-to-cancel liquid fill gesture
 *
 * The liquid fill uses framer-motion's useMotionValue for 60fps rAF updates
 * without causing React re-renders during the animation.
 *
 * Key behavior:
 * - At EXACT moment progress hits 100%, triggers haptic warning and instantly resets
 * - No trailing spring animation or macro-task delay on cancel/release
 * - Snap fill to 0 instantly on cancel (no animated recovery)
 */
type HoldToCancelButtonProps = {
  isInCart: boolean
  onAdd: () => void
  onRemove: () => void
}

const HOLD_DURATION_MS = 1200

export function HoldToCancelButton({
  isInCart,
  onAdd,
  onRemove,
}: HoldToCancelButtonProps) {
  // ── Liquid fill animation via useMotionValue (no re-renders during hold) ──
  const fillPct = useMotionValue(0)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const isHoldingRef = useRef(false)

  const stopFill = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    isHoldingRef.current = false
  }, [])

  const cancelFill = useCallback(() => {
    stopFill()
    // Snap fill back to 0 instantly — no spring animation, no trailing lag
    fillPct.set(0)
  }, [fillPct, stopFill])

  const startFill = useCallback(() => {
    if (isHoldingRef.current) return

    isHoldingRef.current = true
    fillPct.set(0)
    startTimeRef.current = Date.now()

    const tick = () => {
      if (!isHoldingRef.current) return

      const elapsed = Date.now() - startTimeRef.current
      const progress = Math.min(elapsed / HOLD_DURATION_MS, 1)
      fillPct.set(progress * 100)

      if (progress >= 1) {
        // ── EXACT MILLISECOND progress hits 100% ──
        // Stop animation immediately
        isHoldingRef.current = false
        rafRef.current = null

        // Trigger Telegram haptic warning instantly
        try {
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning')
        } catch {
          // Progressive enhancement — ignore outside Telegram
        }

        // Reset fill to 0 immediately (no animate() call = no delay)
        fillPct.set(0)

        // Execute removal — parent state change will re-render as ADD TO CART instantly
        onRemove()
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [fillPct, onRemove])

  // ── Cleanup rAF on unmount ──
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      isHoldingRef.current = false
    }
  }, [])

  // ── Standard click-to-add handler ──
  const handleAdd = useCallback(() => {
    onAdd()
  }, [onAdd])

  // ── Pointer event handlers (works for both touch & mouse) ──
  const handlePointerDown = useCallback(() => {
    if (isInCart) {
      startFill()
    }
  }, [isInCart, startFill])

  const handlePointerUp = useCallback(() => {
    if (isInCart && isHoldingRef.current) {
      cancelFill()
    }
  }, [isInCart, cancelFill])

  const handlePointerLeave = useCallback(() => {
    if (isInCart && isHoldingRef.current) {
      cancelFill()
    }
  }, [isInCart, cancelFill])

  if (!isInCart) {
    // ── Standard ADD TO CART state ──
    return (
      <button
        type="button"
        onClick={handleAdd}
        className="w-full rounded-2xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] py-4 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-[0_8px_24px_rgba(139,61,255,0.3)] transition-all active:scale-[0.98]"
      >
        ADD TO CART
      </button>
    )
  }

  // ── IN CART state with hold-to-cancel ──
  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full select-none overflow-hidden rounded-2xl bg-[#1C1622] py-4 text-sm font-bold uppercase tracking-[0.2em] text-white transition-shadow active:scale-[0.98]"
      style={{ touchAction: 'manipulation' }}
    >
      {/* ── Liquid fill overlay (rises from bottom) ── */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 rounded-2xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))]"
        style={{ height: fillPct }}
      />

      {/* ── Content layer (stays above the fill) ── */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <g transform="translate(2, 2)">
            <path d="M3 4h2l1 3h8l1-3h2" />
            <path d="M6 8l-1 7h10l-1-7" />
            <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
            <circle cx="14" cy="17" r="1" fill="currentColor" stroke="none" />
          </g>
        </svg>
        HOLD TO CANCEL
      </span>
    </button>
  )
}
