import { useRef, useState } from 'react'

import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import type { Product } from '../../types/product'

type ProductDetailPanelProps = {
  product: Product
  isInCart: boolean
  isLiked: boolean
  onAddToCart: (product: Product) => void
  onToggleLike: (product: Product) => void
}

export function ProductDetailPanel({
  product,
  isInCart,
  isLiked,
  onAddToCart,
  onToggleLike,
}: ProductDetailPanelProps) {
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
      <article className="animate-[fade-slide-in_0.4s_ease-out_backwards] overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(38,14,36,0.98),rgba(20,8,20,0.98))] p-5 pb-36 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
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
              src={selectedImage}
              alt={product.name}
              loading="lazy"
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
              onClick={() => {
                triggerHapticFeedback('light')
                void onToggleLike(product)
              }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                isLiked
                  ? 'bg-[var(--shop-red)]/18 text-[var(--shop-red)]'
                  : 'bg-white/10 text-[var(--shop-cream)]'
              }`}
              aria-label={isLiked ? 'Unlike' : 'Like'}
            >
              <svg
                viewBox="0 0 20 20"
                className="h-3.5 w-3.5"
                fill={isLiked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 17.5s-4.5-3.5-6.3-6C2.4 9.8 2.5 7 3.9 5.6a4 4 0 015.1-.5c.6.4 1.1.9 1 1.5-.1.6 0 1.2.3 1.5.3.3.8.4 1.3.2.5-.2 1-.8 1.5-.5 1.5.9 2 3.1.5 5.1-1.8 2.5-6.3 6-6.3 6z" />
              </svg>
              <span>{product.likesCount}</span>
            </button>

            {/* Cart counter */}
            {product.isAvailable ? (
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback('light')
                  onAddToCart(product)
                }}
                disabled={isInCart}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                  isInCart
                    ? 'cursor-not-allowed bg-white/8 text-[var(--shop-muted)]'
                    : 'bg-white/10 text-[var(--shop-cream)]'
                }`}
                aria-label={isInCart ? 'Already in cart' : 'Add to cart'}
              >
                <svg
                  viewBox="0 0 20 20"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 4h2l1 3h8l1-3h2" />
                  <path d="M6 8l-1 7h10l-1-7" />
                  <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
                  <circle cx="14" cy="17" r="1" fill="currentColor" stroke="none" />
                </svg>
                <span>{product.cartCount}</span>
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

      {/* ── STICKY BOTTOM ACTION FOOTER ── */}
      <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
        <div className="w-full max-w-md">
          {product.isAvailable ? (
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('medium')
                onAddToCart(product)
              }}
              disabled={isInCart}
              className={`w-full rounded-2xl py-4 text-sm font-bold uppercase tracking-[0.2em] transition-all ${
                isInCart
                  ? 'cursor-not-allowed bg-white/10 text-[var(--shop-muted)]'
                  : 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white shadow-[0_8px_24px_rgba(139,61,255,0.3)] active:scale-[0.98]'
              }`}
            >
              {isInCart ? 'IN CART' : 'ADD TO CART'}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-2xl bg-white/8 py-4 text-sm font-bold uppercase tracking-[0.2em] text-[var(--shop-muted)]/50"
            >
              OUT OF STOCK
            </button>
          )}
        </div>
      </div>
    </>
  )
}
