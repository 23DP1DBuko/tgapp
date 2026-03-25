import { useMemo, useState } from 'react'

import type { Product } from '../../types/product'

type ProductDetailPanelProps = {
  product: Product
}

export function ProductDetailPanel({ product }: ProductDetailPanelProps) {
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
    <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_40px_rgba(24,24,27,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">
            Product Detail
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
            {product.name}
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            product.isAvailable
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-stone-200 text-stone-600'
          }`}
        >
          {product.isAvailable ? 'Available' : 'Sold Out'}
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] bg-stone-100">
        {selectedImage ? (
          <img
            src={selectedImage}
            alt={product.name}
            className="aspect-[4/5] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[4/5] w-full items-center justify-center text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
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
                  ? 'border-zinc-900'
                  : 'border-black/10'
              }`}
            >
              <img src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-5 text-sm leading-6 text-zinc-700">{product.description}</p>

      <div className="mt-5 flex flex-wrap gap-2 text-xs text-stone-600">
        <span className="rounded-full bg-stone-100 px-3 py-1">
          {product.price} {product.currency}
        </span>
        <span className="rounded-full bg-stone-100 px-3 py-1">{product.category}</span>
        <span className="rounded-full bg-stone-100 px-3 py-1">{createdAtLabel}</span>
        {product.brandNames.map((brand) => (
          <span key={brand} className="rounded-full bg-stone-100 px-3 py-1">
            {brand}
          </span>
        ))}
        {product.isLimitedLabel ? (
          <span className="rounded-full bg-black px-3 py-1 text-white">
            {product.isLimitedLabel}
          </span>
        ) : null}
      </div>
    </article>
  )
}
