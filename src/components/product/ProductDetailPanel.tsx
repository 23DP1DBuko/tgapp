import { useEffect, useRef, useState } from 'react'
import { Heart, ShoppingCart } from 'lucide-react'

import { triggerHapticFeedback, triggerHapticNotification, enableVerticalSwipes, disableVerticalSwipes } from '../../lib/telegram/webApp'
import { CountUp } from '../ui/CountUp'
import { useAddToCartAnimation } from '../../hooks/useAddToCartAnimation'
import { HoldToCancelButton } from './HoldToCancelButton'
import { useNotifySubscription } from '../../hooks/useNotifySubscription'
import { useReferral } from '../../hooks/useReferral'
import { useProductReservation } from '../../hooks/useProductReservation'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { getProductAccessLevel, isEligibleForEarlyAccess } from '../../lib/earlyAccess'
import type { Product } from '../../types/product'
import type { ReservationStatus } from '../../hooks/useProductReservation'

type ProductDetailPanelProps = {
  product: Product
  isInCart: boolean
  isLiked: boolean
  onAddToCart: (product: Product) => void
  onToggleLike: (product: Product) => void
  onRemoveFromCart: (productId: string) => void
  initData: string
}

export function ProductDetailPanel({
  product,
  isInCart,
  isLiked,
  onAddToCart,
  onToggleLike,
  onRemoveFromCart,
  initData,
}: ProductDetailPanelProps) {
  const reducedMotion = useReducedMotion()
  const { isSubscribed, subscribe, unsubscribe } = useNotifySubscription(initData)
  const { referralInfo, referralLink } = useReferral(initData)
  const [copiedReferral, setCopiedReferral] = useState(false)
  const productSubscribed = isSubscribed(product.id)
  const accessLevel = product.isAvailable ? getProductAccessLevel(product) : 'private'
  const isEligible = isEligibleForEarlyAccess(referralInfo?.referralCount ?? 0)

  const { reservationStatus, releaseReservation } = useProductReservation(
    initData,
    product.id,
    product.isAvailable,
  )
  // Enable native vertical swipe (bounce/rubber-banding) on the product detail view
  // so users can swipe down to minimize/close the Mini App.
  // Restore disabled swipes on cleanup when navigating away.
  useEffect(() => {
    enableVerticalSwipes()
    return () => {
      disableVerticalSwipes()
    }
  }, [])

  // Optimistic like count for instant feedback
  const [optimisticLikesCount, setOptimisticLikesCount] = useState(product.likesCount)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptimisticLikesCount(product.likesCount)
  }, [product.likesCount])

  function handleSafeToggleLike() {
    if (!product || typeof product.id !== 'string') {
      return
    }

    try {
      triggerHapticFeedback('light')
      setOptimisticLikesCount((prev) => (isLiked ? prev - 1 : prev + 1))
      void onToggleLike(product)
    } catch {
      // Revert optimistic update on error
      setOptimisticLikesCount(product.likesCount)
    }
  }

  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const dragStartXRef = useRef<number | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const wasDragRef = useRef(false)
  const selectedImage = product.images[selectedImageIndex] ?? product.images[0] ?? null

  // Format date as "21 Apr"
  const dropDateLabel = product.createdAt
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
      })
        .format(product.createdAt.toDate())
        .replace('.', '')
    : 'Recent'

  function moveGallery(direction: 'prev' | 'next') {
    if (product.images.length <= 1) {
      return
    }

    setSelectedImageIndex((currentIndex) => {
      if (direction === 'prev') {
        return currentIndex === 0 ? product.images.length - 1 : currentIndex - 1
      }

      return currentIndex === product.images.length - 1 ? 0 : currentIndex + 1
    })
  }

  function handlePointerStart(clientX: number) {
    dragStartXRef.current = clientX
  }

  function handlePointerEnd(clientX: number) {
    if (dragStartXRef.current === null) {
      return
    }

    const deltaX = clientX - dragStartXRef.current
    wasDragRef.current = Math.abs(deltaX) >= 40
    dragStartXRef.current = null

    if (Math.abs(deltaX) < 40) {
      return
    }

    if (deltaX < 0) {
      moveGallery('next')
      return
    }

    moveGallery('prev')
  }

  const { triggerAddToCartAnimation } = useAddToCartAnimation()

  function handleImageTap(clientX: number, rectWidth: number) {
    if (wasDragRef.current) {
      wasDragRef.current = false
      return
    }

    if (clientX < rectWidth / 2) {
      moveGallery('prev')
    } else {
      moveGallery('next')
    }

    triggerHapticFeedback('light')
  }

  return (
    <>
      <article className="animate-[fade-slide-in_0.4s_ease-out_backwards] overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(38,14,36,0.98),rgba(20,8,20,0.98))] p-5 pb-28 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
        {/* ── HEADER: Title only ── */}
        <h2
          className={`text-[2rem] font-bold leading-tight tracking-[-0.05em] sm:text-[2.2rem] ${
            product.isAvailable
              ? 'text-[var(--shop-cream)]'
              : 'text-[var(--shop-muted)]/70'
          }`}
        >
          {product.name}
        </h2>

        {/* BRAND • CATEGORY */}
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]/70">
          {product.brandNames.join(' - ') || 'BRAND'} &middot; {product.category}
        </p>

        {/* ── IMAGE GALLERY ── */}
        <div
          className="relative mt-5 overflow-hidden rounded-[18px] border border-white/10 bg-black/20"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            activePointerIdRef.current = event.pointerId
            handlePointerStart(event.clientX)
          }}
          onPointerMove={(event) => {
            if (
              activePointerIdRef.current !== event.pointerId ||
              dragStartXRef.current === null
            ) {
              return
            }

            const deltaX = event.clientX - dragStartXRef.current

            if (Math.abs(deltaX) < 40) {
              return
            }

            dragStartXRef.current = event.clientX

            if (deltaX < 0) {
              moveGallery('next')
              return
            }

            moveGallery('prev')
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }

            activePointerIdRef.current = null
            handlePointerEnd(event.clientX)
          }}
          onClick={(event) => {
            if (product.images.length <= 1) {
              return
            }
            const rect = event.currentTarget.getBoundingClientRect()
            handleImageTap(event.clientX, rect.width)
          }}
          onPointerCancel={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }

            activePointerIdRef.current = null
            dragStartXRef.current = null
            wasDragRef.current = false
          }}
        >
          {/* Dot indicators at bottom edge */}
          {product.images.length > 1 ? (
            <div className="absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1.5">
              {product.images.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                    index === selectedImageIndex
                      ? 'w-3 bg-white'
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          ) : null}

          {selectedImage ? (
            <img
              key={product.id}
              src={selectedImage}
              alt={product.name}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              style={reducedMotion ? undefined : { viewTransitionName: `product-img-${product.id}` }}
              className={`aspect-square w-full object-cover transition-all duration-300 ${
                product.isAvailable ? '' : 'grayscale opacity-60'
              }`}
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center text-sm font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              No Image
            </div>
          )}


        </div>

        {/* ── PRICE & SOCIAL METRICS ROW ── */}
        <div className="mt-5 flex items-center justify-between gap-4">
          {/* Price — left side */}
          <p
            className={`text-[1.75rem] font-bold tracking-[-0.04em] ${
              product.isAvailable
                ? 'text-[var(--shop-cream)]'
                : 'text-[var(--shop-muted)]/50 line-through'
            }`}
          >
            {product.price} {product.currency}
          </p>

          {/* Action buttons — right side */}
          <div className="flex items-center gap-2">
            {/* Like button */}
            <button
              type="button"
              onClick={handleSafeToggleLike}
              className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                isLiked
                  ? 'bg-[var(--shop-red)]/18 text-[var(--shop-red)]'
                  : 'bg-white/10 text-[var(--shop-cream)]'
              }`}
              aria-label={isLiked ? 'Unlike' : 'Like'}
            >
              <Heart
                className="w-4 h-4 flex-shrink-0"
                fill={isLiked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              />
              <CountUp value={optimisticLikesCount} duration={400} />
            </button>

            {/* Cart counter */}
            {product.isAvailable ? (
              <button
                type="button"
                onClick={(event) => {
                  triggerHapticFeedback('light')
                  const rect = event.currentTarget.getBoundingClientRect()
                  triggerAddToCartAnimation(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                  )
                  onAddToCart(product)
                }}
                disabled={isInCart}
                className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                  isInCart
                    ? 'cursor-not-allowed bg-white/8 text-[var(--shop-muted)]'
                    : 'bg-white/10 text-[var(--shop-cream)]'
                }`}
                aria-label={isInCart ? 'Already in cart' : 'Add to cart'}
              >
                <ShoppingCart
                  className="w-4 h-4 flex-shrink-0"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <CountUp value={product.cartCount} duration={400} />
              </button>
            ) : null}

            {/* Share referral link */}
            {referralLink ? (
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback('light')
                  try {
                    void navigator.clipboard.writeText(referralLink)
                    setCopiedReferral(true)
                    setTimeout(() => setCopiedReferral(false), 2000)
                  } catch {
                    // Clipboard write failed silently
                  }
                }}
                className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                  copiedReferral
                    ? 'bg-emerald-300/18 text-emerald-100'
                    : 'bg-white/10 text-[var(--shop-cream)]'
                }`}
                aria-label={copiedReferral ? 'Copied' : 'Share referral link'}
              >
                {copiedReferral ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" aria-hidden="true">
          <g transform="translate(2, 2)">

                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  
          </g>
        </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <g transform="translate(2, 2)">

                    <path d="M12.232 4.232a3 3 0 014.242 4.242L9.343 15.61a5 5 0 01-7.07-7.07l4.243-4.243a1 1 0 011.414 1.414l-4.242 4.243a3 3 0 004.242 4.242l7.071-7.07a1 1 0 00-1.414-1.415l-1.414 1.415a3 3 0 01-4.242-4.243l1.414-1.414z" />
                  
          </g>
        </svg>
                )}
              </button>
            ) : null}
          </div>
        </div>

        {/* ── DESCRIPTION ── */}
        <p
          className={`mt-5 text-base leading-7 ${
            product.isAvailable
              ? 'text-[var(--shop-muted)]'
              : 'text-[var(--shop-muted)]/60'
          }`}
        >
          {product.description}
        </p>

        {/* ── DROP DATE ── */}
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]/50">
          Dropped: {dropDateLabel}
        </p>
      </article>

      {/* ── EARLY ACCESS STATUS ── */}
      {accessLevel === 'early_access' && !isEligible ? (
        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
            Early Access
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--shop-muted)]">
            This item is in early access. Refer at least 1 friend to unlock purchasing.
          </p>
        </div>
      ) : null}

      {/* ── RESERVATION STATUS ── */}
      {product.isAvailable && (
        <ReservationStatusBanner
          status={reservationStatus}
          onRelease={releaseReservation}
        />
      )}

      {/* ── STICKY BOTTOM ACTION FOOTER ── */}
      <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
        <div className="w-full max-w-md">
          {accessLevel === 'early_access' && !isEligible ? (
            <button
              type="button"
              onClick={async () => {
                if (productSubscribed) {
                  triggerHapticFeedback('light')
                  await unsubscribe(product.id)
                } else {
                  await subscribe(product.id)
                  triggerHapticNotification('success')
                }
              }}
              className={`w-full rounded-2xl py-4 text-sm font-bold uppercase tracking-[0.2em] transition-all active:scale-[0.98] ${
                productSubscribed
                  ? 'border-2 border-[var(--shop-purple)] bg-[var(--shop-purple)]/12 text-[var(--shop-purple)]'
                  : 'border-2 border-dashed border-amber-500/30 bg-amber-500/12 text-amber-400'
              }`}
            >
              {productSubscribed ? 'NOTIFY ME ✓' : 'NOTIFY ME WHEN PUBLIC'}
            </button>
          ) : (
            <>
              {product.isAvailable ? (
                <>
                  {(reservationStatus.kind === 'reserved' || reservationStatus.kind === 'already_yours') ? (
                    <HoldToCancelButton
                      isInCart={isInCart}
                      onAdd={() => onAddToCart(product)}
                      onRemove={() => onRemoveFromCart(product.id)}
                    />
                  ) : reservationStatus.kind === 'loading' ? (
                    <div className="w-full rounded-2xl border border-white/10 bg-white/6 py-4 text-center text-sm font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
                      Reserving piece...
                    </div>
                  ) : reservationStatus.kind === 'already_reserved' ? (
                    <div className="w-full rounded-2xl border-2 border-amber-500/20 bg-amber-500/8 py-4 text-center text-sm font-bold uppercase tracking-[0.2em] text-amber-400">
                      Currently Reserved · Check Back Soon
                    </div>
                  ) : (
                    <HoldToCancelButton
                      isInCart={isInCart}
                      onAdd={() => onAddToCart(product)}
                      onRemove={() => onRemoveFromCart(product.id)}
                    />
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (productSubscribed) {
                      triggerHapticFeedback('light')
                      await unsubscribe(product.id)
                    } else {
                      await subscribe(product.id)
                      triggerHapticNotification('success')
                    }
                  }}
                  className={`w-full rounded-2xl py-4 text-sm font-bold uppercase tracking-[0.2em] transition-all active:scale-[0.98] ${
                    productSubscribed
                      ? 'border-2 border-[var(--shop-purple)] bg-[var(--shop-purple)]/12 text-[var(--shop-purple)] shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                      : 'border-2 border-[var(--shop-purple)]/40 bg-[var(--shop-panel)] text-[var(--shop-cream)] shadow-[0_0_20px_rgba(168,85,247,0.12)]'
                  }`}
                >
                  {productSubscribed ? 'NOTIFY ME ✓' : 'NOTIFY ME'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Reservation Status Banner ──

type ReservationStatusBannerProps = {
  status: ReservationStatus
  onRelease: () => void
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function ReservationStatusBanner({
  status,
  onRelease,
}: ReservationStatusBannerProps) {
  if (status.kind !== 'reserved' && status.kind !== 'already_yours' && status.kind !== 'already_reserved') {
    return null
  }

  if (status.kind === 'already_reserved') {
    return (
      <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true">
          <g transform="translate(2, 2)">

            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          
          </g>
        </svg>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
            Reserved by another buyer
          </p>
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
          This piece is currently reserved. Check back later — it will become available if not purchased.
        </p>
      </div>
    )
  }

  const remainingMs = status.remainingMs

  if (remainingMs <= 0) {
    return null
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
            Reserved for you
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            triggerHapticFeedback('light')
            onRelease()
          }}
          className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-muted)] hover:text-[var(--shop-cream)]"
        >
          Release
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" aria-hidden="true">
          <g transform="translate(4, 4)">

          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 3.5v3.19l2.53 1.53a.75.75 0 01-.75 1.28l-3-1.8A.75.75 0 017 8.06V4.5a.75.75 0 011.5 0z" />
        
          </g>
        </svg>
        <span className="font-mono text-sm font-bold tracking-[-0.02em] text-emerald-300">
          {formatCountdown(remainingMs)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-muted)]">
          remaining
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
        This piece is reserved while you complete your order. Head to cart to start the checkout process.
      </p>
    </div>
  )
}
