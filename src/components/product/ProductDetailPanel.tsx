import { useEffect, useRef, useState } from 'react'
import { Heart, ShoppingCart } from 'lucide-react'

import { triggerHapticFeedback, enableVerticalSwipes, disableVerticalSwipes } from '../../lib/telegram/webApp'
import { CountUp } from '../ui/CountUp'
import { useAddToCartAnimation } from '../../hooks/useAddToCartAnimation'
import { HoldToCancelButton } from './HoldToCancelButton'
import { useReferral } from '../../hooks/useReferral'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useI18n } from '../../lib/i18n'
import { formatDateTime, formatDropDate } from '../../lib/i18n/locale'
import {
  getProductDiscountLabel,
  getProductEffectivePrice,
  hasProductDiscount,
} from '../../lib/productPrice'
import {
  EARLY_ACCESS_REFERRAL_THRESHOLD,
  getProductAccessLevel,
  isEligibleForEarlyAccess,
  referralFriendsWord,
} from '../../lib/earlyAccess'
import type { Product } from '../../types/product'

type ProductDetailPanelProps = {
  product: Product
  isInCart: boolean
  isLiked: boolean
  /** True when this product is a prize in a non-draft giveaway — it can be
   *  viewed but not bought; the cart controls are replaced by a notice. */
  isGiveawayPrize: boolean
  /** True when the product's giveaway has already been drawn — shown as
   *  "Given Away" with no enter-giveaway CTA. */
  isGivenAway: boolean
  onAddToCart: (product: Product) => void
  onToggleLike: (product: Product) => void
  onRemoveFromCart: (productId: string) => void
  onOpenRewards: () => void
  initData: string
}

export function ProductDetailPanel({
  product,
  isInCart,
  isLiked,
  isGiveawayPrize,
  isGivenAway,
  onAddToCart,
  onToggleLike,
  onRemoveFromCart,
  onOpenRewards,
  initData,
}: ProductDetailPanelProps) {
  const { t, language } = useI18n()
  const reducedMotion = useReducedMotion()
  const { referralInfo } = useReferral(initData)
  const accessLevel = product.isAvailable ? getProductAccessLevel(product) : 'private'
  const referralCount = referralInfo?.referralCount ?? 0
  const isEligible = isEligibleForEarlyAccess(referralCount)
  const hasDiscount = hasProductDiscount(product)
  const effectivePrice = getProductEffectivePrice(product.price, product.discountType, product.discountValue)
  const discountLabel = getProductDiscountLabel(product)
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
  const earlyAccessParams = {
    needed: EARLY_ACCESS_REFERRAL_THRESHOLD,
    friends: referralFriendsWord(),
  }

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

  // Format date as "21 Apr" / "21 апр." / "21. apr." in the selected language
  const dropDateLabel = product.createdAt
    ? formatDropDate(language, product.createdAt.toDate())
    : t('product.recent')

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
          {product.brandNames.join(' - ') || t('product.brand')} &middot; {product.category}
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
              {t('product.noImage')}
            </div>
          )}


        </div>

        {/* ── PRICE & SOCIAL METRICS ROW ── */}
        <div className="mt-5 flex items-center justify-between gap-4">
          {/* Price — left side (struck original + discounted price when on sale) */}
          <div className="flex min-w-0 items-baseline gap-2.5">
            {hasDiscount && product.isAvailable ? (
              <span className="text-base font-semibold tracking-[-0.03em] text-[var(--shop-muted)]/50 line-through">
                {product.price} {product.currency}
              </span>
            ) : null}
            <p
              className={`text-[1.75rem] font-bold tracking-[-0.04em] ${
                product.isAvailable
                  ? 'text-[var(--shop-cream)]'
                  : 'text-[var(--shop-muted)]/50 line-through'
              }`}
            >
              {effectivePrice} {product.currency}
            </p>
            {hasDiscount && product.isAvailable && discountLabel ? (
              <span className="rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-black">
                {discountLabel}
              </span>
            ) : null}
          </div>

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
              aria-label={isLiked ? t('product.unlikeAria') : t('product.likeAria')}
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

            {/* Cart counter — hidden for giveaway prizes / given-away items (not buyable) */}
            {product.isAvailable && !isGiveawayPrize && !isGivenAway ? (
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
                aria-label={isInCart ? t('product.inCartAria') : t('product.addToCartAria')}
              >
                <ShoppingCart
                  className="w-4 h-4 flex-shrink-0"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <CountUp value={product.cartCount} duration={400} />
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
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]/70">
          {t('product.dropped')} {dropDateLabel}
        </p>
      </article>

      {/* ── SCHEDULED DROP / EARLY ACCESS STATUS ── */}
      {isNotBuyable ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            {t('catalog.upcoming')}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--shop-muted)]">
            {notBuyableLabel}
          </p>
        </div>
      ) : accessLevel === 'early_access' && !isEligible ? (
        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
            {t('product.earlyAccess')}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--shop-muted)]">
            {t('product.earlyAccessBody', earlyAccessParams)}
          </p>
        </div>
      ) : null}

      {/* ── PINNED BOTTOM ACTION BAR ── */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto w-full max-w-md bg-gradient-to-t from-[var(--shop-void)] via-[var(--shop-void)]/92 to-transparent px-4 pb-5 pt-10">
          {isGiveawayPrize ? (
            <div className="w-full rounded-2xl border-2 border-dashed border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-amber-400">
                {t('card.giveawayPrize')}
              </p>
              <p className="mt-1 text-center text-[11px] leading-5 text-amber-200/80">
                {t('product.giveawayPrize')}
              </p>
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback('light')
                  onOpenRewards()
                }}
                className="mt-2.5 w-full rounded-xl border border-amber-500/30 bg-amber-500/15 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-amber-400 transition-colors hover:bg-amber-500/20 active:scale-[0.98]"
              >
                {t('product.giveawayCta')}
              </button>
            </div>
          ) : isGivenAway ? (
            <div className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/8 px-4 py-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                {t('card.givenAway')}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--shop-muted)]/70">
                {t('product.givenAway')}
              </p>
            </div>
          ) : isNotBuyable ? (
            <div className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/8 py-4 text-center text-sm font-bold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              {notBuyableLabel}
            </div>
          ) : accessLevel === 'early_access' && !isEligible ? (
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('light')
                onOpenRewards()
              }}
              className="w-full rounded-2xl border-2 border-dashed border-amber-500/30 bg-amber-500/12 py-3 text-center transition-colors hover:bg-amber-500/18 active:scale-[0.98]"
            >
              <span className="block text-sm font-bold uppercase tracking-[0.2em] text-amber-400">
                {t('product.earlyAccessCta', earlyAccessParams)}
              </span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/70">
                {t('product.earlyAccessProgress', {
                  count: referralCount,
                  needed: EARLY_ACCESS_REFERRAL_THRESHOLD,
                })}
              </span>
            </button>
          ) : product.isAvailable ? (
            <HoldToCancelButton
              isInCart={isInCart}
              onAdd={() => onAddToCart(product)}
              onRemove={() => onRemoveFromCart(product.id)}
            />
          ) : (
            <div className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/8 py-4 text-center text-sm font-bold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              {t('product.soldOut')}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
