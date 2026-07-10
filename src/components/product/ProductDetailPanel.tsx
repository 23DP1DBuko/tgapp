import { useRef, useState } from 'react'

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
  const selectedImage = product.images[selectedImageIndex] ?? product.images[0] ?? null
  const createdAtLabel = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-[var(--shop-cream)] sm:text-[2.2rem]">
          {product.name}
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
            product.isAvailable
              ? 'bg-emerald-300/18 text-emerald-100'
              : 'bg-[var(--shop-red)]/18 text-[var(--shop-cream)]'
          }`}
        >
          {product.isAvailable ? 'Live' : 'Sold Out'}
        </span>
      </div>

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
        onPointerCancel={(event) => {
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
            loading="lazy"
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
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {product.images.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-between px-4">
            <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] backdrop-blur-sm">
              {selectedImageIndex + 1}/{product.images.length}
            </span>
          </div>
        ) : null}
      </div>

      {product.images.length > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5">
          {product.images.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                selectedImageIndex === index ? 'bg-white' : 'bg-white/25'
              }`}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-4">
          <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--shop-cream)]">
            {product.price} {product.currency}
          </p>
          <button
            type="button"
            onClick={() => onToggleLike(product)}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
              isLiked
                ? 'border-[var(--shop-red)] bg-[var(--shop-red)]/18 text-[var(--shop-red)]'
                : 'border-white/10 bg-white/8 text-[var(--shop-muted)]'
            }`}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-6.7-4.4-9.2-8.1C.8 10 .9 6.5 3.6 4.7c2.2-1.5 5.1-.8 6.8 1.3C12 3.9 14.8 3.2 17 4.7c2.7 1.8 2.8 5.3.8 8.2C18.7 14.2 12 21 12 21Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            disabled={!product.isAvailable || isInCart}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={
              !product.isAvailable ? 'Sold out' : isInCart ? 'In cart' : 'Add to cart'
            }
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h10l-1.2 6H6.2L4.8 9.5" />
              <path d="M4 7 3 4H1.5" />
              <circle cx="7.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="13.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--shop-muted)]">
          {product.brandNames.join(' - ') || 'Brand'} · {product.category}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <SnapshotCard label="Attention" value={`${attentionValue}`} />
        <SnapshotCard label="Gallery" value={`${product.images.length}`} />
        <SnapshotCard
          label="Drop Date"
          value={
            product.createdAt
              ? createdAtLabel.format(product.createdAt.toDate())
              : 'Recently'
          }
        />
        <SnapshotCard
          label="Availability"
          value={product.isAvailable ? 'Live' : 'Sold'}
        />
      </div>

      <p className="mt-5 text-base italic leading-7 text-[var(--shop-muted)]">
        {product.description}
      </p>
    </article>
  )
}

type SnapshotCardProps = {
  label: string
  value: string
}

function SnapshotCard({ label, value }: SnapshotCardProps) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/6 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-[var(--shop-cream)]">{value}</p>
    </div>
  )
}


