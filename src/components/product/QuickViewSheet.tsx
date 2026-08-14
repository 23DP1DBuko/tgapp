import { useState } from 'react'
import { Heart } from 'lucide-react'

import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import {
  EARLY_ACCESS_REFERRAL_THRESHOLD,
  getProductAccessLevel,
  isEligibleForEarlyAccess,
  referralFriendsWord,
} from '../../lib/earlyAccess'
import { useReferral } from '../../hooks/useReferral'
import { BottomSheet } from '../ui/BottomSheet'
import { useI18n } from '../../lib/i18n'
import { formatDateTime } from '../../lib/i18n/locale'
import {
  getProductDiscountLabel,
  getProductEffectivePrice,
  hasProductDiscount,
} from '../../lib/productPrice'
import { HoldToCancelButton } from './HoldToCancelButton'
import type { Product } from '../../types/product'

type QuickViewSheetProps = {
  isOpen: boolean
  product: Product | null
  isLiked: boolean
  isInCart: boolean
  /** True when the product is a prize in a non-draft giveaway — not buyable. */
  isGiveawayPrize: boolean
  /** True when the product's giveaway has already been drawn — shown as "Given Away". */
  isGivenAway: boolean
  onClose: () => void
  onToggleLike: (product: Product) => void
  onAddToCart: (product: Product) => void
  onRemoveFromCart: (productId: string) => void
  onOpenDetail: (productId: string) => void
  onOpenRewards: () => void
  initData: string
}

export function QuickViewSheet({
  isOpen,
  product,
  isLiked,
  isInCart,
  isGiveawayPrize,
  isGivenAway,
  onClose,
  onToggleLike,
  onAddToCart,
  onRemoveFromCart,
  onOpenDetail,
  onOpenRewards,
  initData,
}: QuickViewSheetProps) {
  const { t, language } = useI18n()
  const hasDiscount = product ? hasProductDiscount(product) : false
  const effectivePrice = product
    ? getProductEffectivePrice(product.price, product.discountType, product.discountValue)
    : 0
  const discountLabel = product ? getProductDiscountLabel(product) : null
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  // Fetch referral status only while the sheet is actually open — the sheet
  // is always mounted in the catalog, so this avoids a fetch on every visit.
  const { referralInfo } = useReferral(initData, isOpen && product !== null)

  if (!product) return null

  const accessLevel = product.isAvailable
    ? getProductAccessLevel(product)
    : 'private'
  const isEarlyAccessRestricted =
    accessLevel === 'early_access' &&
    !isEligibleForEarlyAccess(referralInfo?.referralCount ?? 0)
  const dropStartDate =
    product.earlyAccessAt?.toDate() ?? product.publicAt?.toDate()
  const dropStartLabel = dropStartDate
    ? formatDateTime(language, dropStartDate)
    : ''

  // Flag-only "upcoming" products (no scheduled dates) are not for sale yet
  const isUpcomingFlagged = product.upcoming === true && accessLevel === 'public'
  const isNotBuyable = accessLevel === 'private' || isUpcomingFlagged
  const notBuyableLabel = accessLevel === 'private'
    ? t('product.dropStarts', { date: dropStartLabel })
    : t('product.comingSoon')
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
    <BottomSheet isOpen={isOpen} onClose={onClose} label={product?.name} maxHeightPct={80}>
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
            {t('qv.noImage')}
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
          <span className="flex shrink-0 items-baseline gap-1.5">
            {hasDiscount ? (
              <span className="text-xs font-medium text-[var(--shop-muted)]/60 line-through">
                {product.price} {product.currency}
              </span>
            ) : null}
            <span className="text-lg font-bold tracking-[-0.03em] text-[var(--shop-cream)]">
              {effectivePrice} {product.currency}
            </span>
            {hasDiscount && discountLabel ? (
              <span className="rounded-full bg-amber-400/95 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-black">
                {discountLabel}
              </span>
            ) : null}
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
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]/70">
            {t('qv.unavailable')}
          </p>
        )}
        {accessLevel === 'early_access' && (
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">
            {t('qv.earlyAccess')}
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
          aria-label={isLiked ? t('qv.unlikeAria') : t('qv.likeAria')}
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

        {/* Dynamic center: Add to cart when available, static label when sold out/upcoming */}
        {isGiveawayPrize ? (
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('light')
              onOpenRewards()
              onClose()
            }}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-amber-500/30 bg-amber-500/12 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-400 transition-colors hover:bg-amber-500/18 active:scale-[0.98]"
          >
            {t('product.giveawayCta')}
          </button>
        ) : isGivenAway ? (
          <div className="flex h-12 flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/8 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
            {t('card.givenAway')}
          </div>
        ) : isNotBuyable ? (
          <div className="flex h-12 flex-1 cursor-not-allowed items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/8 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
            {notBuyableLabel}
          </div>
        ) : isEarlyAccessRestricted ? (
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('light')
              onOpenRewards()
              onClose()
            }}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-amber-500/30 bg-amber-500/12 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400 transition-colors hover:bg-amber-500/18 active:scale-[0.98]"
          >
            {t('product.earlyAccessCta', {
              needed: EARLY_ACCESS_REFERRAL_THRESHOLD,
              friends: referralFriendsWord(),
            })}
          </button>
        ) : product.isAvailable ? (
          <div className="flex-1">
            <HoldToCancelButton
              isInCart={isInCart}
              onAdd={() => onAddToCart(product)}
              onRemove={() => onRemoveFromCart(product.id)}
            />
          </div>
        ) : (
          <div className="flex h-12 flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/8 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
            {t('qv.unavailableCta')}
          </div>
        )}

        {/* Details button — matches h-12 + rounded-2xl */}
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('light')
            onOpenDetail(product.id)
            onClose()
          }}
          className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-[var(--shop-panel-solid)] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#2a1f30]"
        >
          {t('qv.details')}
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
