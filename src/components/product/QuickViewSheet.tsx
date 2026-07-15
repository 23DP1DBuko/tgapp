import { useState } from 'react'
import { Heart } from 'lucide-react'

import { triggerHapticFeedback, triggerHapticNotification } from '../../lib/telegram/webApp'
import { getProductAccessLevel } from '../../lib/earlyAccess'
import { BottomSheet } from '../ui/BottomSheet'
import { HoldToCancelButton } from './HoldToCancelButton'
import type { Product } from '../../types/product'

type QuickViewSheetProps = {
  isOpen: boolean
  product: Product | null
  isLiked: boolean
  isInCart: boolean
  isSubscribed: boolean
  onClose: () => void
  onToggleLike: (product: Product) => void
  onAddToCart: (product: Product) => void
  onRemoveFromCart: (productId: string) => void
  onSubscribe: (productId: string) => Promise<void>
  onUnsubscribe: (productId: string) => Promise<void>
  onOpenDetail: (productId: string) => void
}

export function QuickViewSheet({
  isOpen,
  product,
  isLiked,
  isInCart,
  isSubscribed: productSubscribed,
  onClose,
  onToggleLike,
  onAddToCart,
  onRemoveFromCart,
  onSubscribe,
  onUnsubscribe,
  onOpenDetail,
}: QuickViewSheetProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  if (!product) return null

  const accessLevel = product.isAvailable
    ? getProductAccessLevel(product)
    : 'private'
  const images = product.images.length > 0 ? product.images : [null]
  const currentImage = images[selectedImageIndex] ?? images[0] ?? null

  function moveGallery(direction: 'prev' | 'next') {
    if (images.length <= 1) return
    setSelectedImageIndex((i) => {
      if (direction === 'prev') return i === 0 ? images.length - 1 : i - 1
      return i === images.length - 1 ? 0 : i + 1
    })
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeightPct={80}>
      {/* Image gallery */}
      <div
        className="relative overflow-hidden rounded-[18px] border border-white/10 bg-black/20"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          if (images.length <= 1) return
          e.currentTarget.setPointerCapture(e.pointerId)
          ;(e.currentTarget as unknown as { _startX: number })._startX = e.clientX
        }}
        onPointerUp={(e) => {
          if (images.length <= 1) return
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
          const startX = (e.currentTarget as unknown as { _startX?: number })._startX
          if (startX == null) return
          const delta = e.clientX - startX
          if (Math.abs(delta) > 30) {
            moveGallery(delta > 0 ? 'prev' : 'next')
          }
          ;(e.currentTarget as unknown as { _startX: number | undefined })._startX = undefined
        }}
      >
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === selectedImageIndex ? 'w-3 bg-white' : 'w-1.5 bg-white/30'
                }`}
              />
            ))}
          </div>
        )}

        {currentImage ? (
          <img
            src={currentImage}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
            No Image
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
              {product.name}
            </h3>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]/70">
              {product.brandNames.join(' - ') || product.category}
            </p>
          </div>
          <span className="shrink-0 text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
            {product.price} {product.currency}
          </span>
        </div>

        {/* Description preview */}
        {product.description && (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--shop-muted)]/80">
            {product.description}
          </p>
        )}

        {/* Availability label */}
        {!product.isAvailable && (
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]/50">
            Currently unavailable
          </p>
        )}
        {accessLevel === 'early_access' && (
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">
            Early Access
          </p>
        )}
      </div>

      {/* ── UNIFIED ACTION ROW: all buttons share h-12 + rounded-2xl ── */}
      <div className="mt-5 flex w-full items-center gap-3">
        {/* Like button — Lucide Heart with strict w-4 h-4 flex-shrink-0 */}
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('light')
            onToggleLike(product)
          }}
          className={`flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl px-4 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
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
          {product.likesCount}
        </button>

        {/* Dynamic center: HoldToCancelButton when available, Notify Me toggle when sold out/upcoming */}
        {product.isAvailable ? (
          <div className="flex-1">
            <HoldToCancelButton
              isInCart={isInCart}
              onAdd={() => onAddToCart(product)}
              onRemove={() => onRemoveFromCart(product.id)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={async () => {
              triggerHapticFeedback('light')
              if (productSubscribed) {
                await onUnsubscribe(product.id)
              } else {
                await onSubscribe(product.id)
                triggerHapticNotification('success')
              }
            }}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] transition-all active:scale-[0.98] ${
              productSubscribed
                ? 'border-2 border-[var(--shop-purple)] bg-[var(--shop-purple)]/12 text-[var(--shop-purple)]'
                : 'border-2 border-dashed border-white/20 bg-white/8 text-[var(--shop-cream)]'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill={productSubscribed ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {productSubscribed ? 'NOTIFY ME ✓' : 'NOTIFY ME'}
          </button>
        )}

        {/* Details button — matches h-12 + rounded-2xl */}
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('light')
            onOpenDetail(product.id)
            onClose()
          }}
          className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-[#1C1622] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#2a1f30]"
        >
          Details
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
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </BottomSheet>
  )
}
