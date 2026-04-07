import { useMemo, useState } from 'react'

import type { Product } from '../../types/product'

type ProductDetailPanelProps = {
  product: Product
  isInCart: boolean
  onAddToCart: (product: Product) => void
}

export function ProductDetailPanel({
  product,
  isInCart,
  onAddToCart,
}: ProductDetailPanelProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
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

  return (
    <article className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(44,16,42,0.96),rgba(23,9,23,0.96))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-[var(--shop-muted)]">
            Selected Drop
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--shop-cream)]">
            {product.name}
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
            product.isAvailable
              ? 'bg-emerald-300/18 text-emerald-100'
              : 'bg-white/10 text-[var(--shop-muted)]'
          }`}
        >
          {product.isAvailable ? 'Available' : 'Sold Out'}
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-[28px] bg-black/20 ring-1 ring-white/8">
        {selectedImage ? (
          <img
            src={selectedImage}
            alt={product.name}
            className="aspect-[4/5] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[4/5] w-full items-center justify-center text-sm font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
            No Image
          </div>
        )}
      </div>

      {product.images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {product.images.map((image, index) => (
            <button
              key={`${product.id}-${image}`}
              type="button"
              onClick={() => setSelectedImageIndex(index)}
              className={`h-16 w-14 shrink-0 overflow-hidden rounded-2xl border ${
                selectedImageIndex === index
                  ? 'border-[var(--shop-red)]'
                  : 'border-white/10'
              }`}
            >
              <img src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-5 text-sm leading-6 text-[var(--shop-muted)]">{product.description}</p>

      <div className="mt-5 flex flex-wrap gap-2 text-xs text-[var(--shop-cream)]">
        <span className="rounded-full bg-white/8 px-3 py-1">
          {product.price} {product.currency}
        </span>
        <span className="rounded-full bg-[var(--shop-purple)]/20 px-3 py-1">{product.category}</span>
        <span className="rounded-full bg-white/8 px-3 py-1">{createdAtLabel}</span>
        {product.brandNames.map((brand) => (
          <span key={brand} className="rounded-full bg-[var(--shop-magenta)]/18 px-3 py-1">
            {brand}
          </span>
        ))}
        {product.isLimitedLabel ? (
          <span className="rounded-full bg-[var(--shop-red)] px-3 py-1 text-white">
            {product.isLimitedLabel}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onAddToCart(product)}
        disabled={!product.isAvailable || isInCart}
        className="mt-5 w-full rounded-[24px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-55"
      >
        {!product.isAvailable
          ? 'Sold Out'
          : isInCart
            ? 'Already In Cart'
            : 'Add To Cart'}
      </button>
    </article>
  )
}
