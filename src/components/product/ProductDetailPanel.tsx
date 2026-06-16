import { useMemo, useRef, useState } from 'react'

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
  const supportsTouchSwipe =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const selectedImage = product.images[selectedImageIndex] ?? product.images[0] ?? null
  const createdAtLabel = useMemo(() => {
    if (!product.createdAt) {
      return 'Recently added'
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(product.createdAt.toDate())
  }, [product.createdAt])
  const urgencyCopy = useMemo(() => {
    if (!product.isAvailable) {
      return 'This piece is archived in the sold drop.'
    }

    if (product.cartCount > 0) {
      return `${product.cartCount} people already added this piece`
    }

    if (product.likesCount > 0) {
      return `${product.likesCount} people are watching this piece`
    }

    return 'Fresh in the current drop.'
  }, [product.cartCount, product.isAvailable, product.likesCount])
  const actionLabel = !product.isAvailable
    ? 'Sold Out'
    : isInCart
      ? 'In Cart'
      : 'Add To Cart'
  const attentionValue = product.likesCount + product.cartCount

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

  return (
    <article className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(38,14,36,0.98),rgba(20,8,20,0.98))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-[var(--shop-muted)]">
            Product
          </p>
          <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-[var(--shop-cream)] sm:truncate sm:text-[2.2rem]">
            {product.name}
          </h2>
        </div>
        <span
          className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
            product.isAvailable
              ? 'bg-emerald-300/18 text-emerald-100'
              : 'bg-white/10 text-[var(--shop-muted)]'
          }`}
        >
          {product.isAvailable ? 'Available' : 'Sold Out'}
        </span>
      </div>

      <div
        className="relative mt-5 overflow-hidden rounded-[18px] border border-white/10 bg-black/20"
        style={{ touchAction: supportsTouchSwipe ? 'pan-y' : 'auto' }}
        onPointerDown={(event) => {
          if (!supportsTouchSwipe) {
            return
          }

          event.currentTarget.setPointerCapture(event.pointerId)
          activePointerIdRef.current = event.pointerId
          handlePointerStart(event.clientX)
        }}
        onPointerMove={(event) => {
          if (!supportsTouchSwipe) {
            return
          }

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
          if (!supportsTouchSwipe) {
            return
          }

          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }

          activePointerIdRef.current = null
          handlePointerEnd(event.clientX)
        }}
        onPointerCancel={(event) => {
          if (!supportsTouchSwipe) {
            return
          }

          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }

          activePointerIdRef.current = null
          dragStartXRef.current = null
        }}
      >
        {selectedImage ? (
          <img
            src={selectedImage}
            alt={product.name}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center text-sm font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
            No Image
          </div>
        )}
        {product.images.length > 1 ? (
          <div className="pointer-events-none absolute left-3 right-3 top-3 flex justify-start">
            <div className="pointer-events-auto flex max-w-full gap-2 overflow-x-auto rounded-[14px] bg-black/25 p-2 backdrop-blur-sm">
              {product.images.map((image, index) => (
                <button
                  key={`${product.id}-${image}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  className={`h-12 w-12 shrink-0 overflow-hidden rounded-[8px] border bg-black/30 sm:h-14 sm:w-14 ${
                    selectedImageIndex === index
                      ? 'border-[var(--shop-red)]'
                      : 'border-white/10'
                  }`}
                >
                  <img
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {supportsTouchSwipe && product.images.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-between px-4">
            <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] backdrop-blur-sm">
              Swipe Photos
            </span>
            <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] backdrop-blur-sm">
              {selectedImageIndex + 1}/{product.images.length}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-3xl font-semibold tracking-[-0.05em] text-[var(--shop-cream)]">
            {product.price} {product.currency}
          </p>
          <p className="mt-2 text-sm uppercase tracking-[0.18em] text-[var(--shop-muted)]">
            {product.brandNames.join(' - ') || 'Brand'} · {product.category}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onToggleLike(product)}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-full border px-4 transition-colors ${
              isLiked
                ? 'border-[var(--shop-red)] bg-[var(--shop-red)]/18 text-[var(--shop-cream)]'
                : 'border-white/10 bg-white/8 text-[var(--shop-cream)]'
            }`}
            aria-label={isLiked ? 'Unlike product' : 'Like product'}
          >
            <HeartIcon filled={isLiked} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
              {isLiked ? 'Loved' : 'Love'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onAddToCart(product)}
            disabled={!product.isAvailable || isInCart}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-55"
            aria-label={
              !product.isAvailable ? 'Sold out' : isInCart ? 'Already in cart' : 'Add to cart'
            }
          >
            <CartArrowIcon />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
              {actionLabel}
            </span>
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SnapshotCard
          label="Attention"
          value={`${attentionValue}`}
          hint="combined loves + carts"
        />
        <SnapshotCard
          label="Gallery"
          value={`${product.images.length}`}
          hint={product.images.length > 1 ? 'angles ready to swipe' : 'single hero image'}
        />
        <SnapshotCard
          label="Drop Date"
          value={createdAtLabel}
          hint="added to the current rotation"
        />
        <SnapshotCard
          label="Availability"
          value={product.isAvailable ? 'Live' : 'Sold'}
          hint={product.isAvailable ? 'still open for checkout' : 'kept in the sold archive'}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
        <span>{product.likesCount} loves</span>
        <span>{product.cartCount} in carts</span>
        <span>{createdAtLabel}</span>
        {product.isLimitedLabel ? (
          <span className="text-[var(--shop-cream)]">{product.isLimitedLabel}</span>
        ) : null}
      </div>

      <p className="mt-5 text-sm font-medium uppercase tracking-[0.16em] text-[var(--shop-cream)]">
        {product.brandNames.join(' - ') || 'Brand'} {product.isAvailable ? '' : '· Sold'}
      </p>

      <p className="mt-3 text-base italic leading-7 text-[var(--shop-muted)]">
        {product.description}
      </p>

      <div className="mt-5 rounded-[24px] border border-white/10 bg-white/6 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
          Drop Signal
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--shop-cream)]">{urgencyCopy}</p>
      </div>

      <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
          What To Expect
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
          Limited pieces move through manual admin follow-up in Telegram. If you lock it in, the
          order stays tied to your Telegram identity and the next handoff step comes in chat.
        </p>
      </div>
    </article>
  )
}

type SnapshotCardProps = {
  label: string
  value: string
  hint: string
}

function SnapshotCard({ label, value, hint }: SnapshotCardProps) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/6 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-[var(--shop-cream)]">{value}</p>
      <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--shop-muted)]">
        {hint}
      </p>
    </div>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-6.7-4.4-9.2-8.1C.8 10 .9 6.5 3.6 4.7c2.2-1.5 5.1-.8 6.8 1.3C12 3.9 14.8 3.2 17 4.7c2.7 1.8 2.8 5.3.8 8.2C18.7 14.2 12 21 12 21Z" />
    </svg>
  )
}

function CartArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h10l-1.2 6H6.2L4.8 9.5" />
      <path d="M4 7 3 4H1.5" />
      <circle cx="7.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <path d="M15 8.5h5" />
      <path d="m18 5.5 3 3-3 3" />
    </svg>
  )
}


