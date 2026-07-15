import { useEffect, useMemo, useState } from 'react'

import { listAllProducts } from '../../lib/firebase/products'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import type { Product } from '../../types/product'

type ProductPickerModalProps = {
  open: boolean
  onSelect: (product: { id: string; name: string; image: string }) => void
  onClose: () => void
  cachedProducts?: Array<{ id: string; name: string; image: string; category: string }> | null
}

export function ProductPickerModal({ open, onSelect, onClose, cachedProducts }: ProductPickerModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!open) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch('')
    setClosing(false)

    // If cached products are available, skip the remote fetch
    if (cachedProducts && cachedProducts.length > 0) {
      setProducts([])
      setLoading(false)
      return
    }

    setLoading(true)
    listAllProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [open])

  function handleClose() {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }

  function handleSelect(product: Product | { id: string; name: string; image: string; category: string }) {
    triggerHapticFeedback('light')
    const image = 'images' in product
      ? (product as Product).images[0] ?? ''
      : product.image
    onSelect({
      id: product.id,
      name: product.name,
      image,
    })
    handleClose()
  }

  const displayProducts = useMemo(() => {
    if (cachedProducts && cachedProducts.length > 0) {
      return cachedProducts
    }
    return products
  }, [cachedProducts, products])

  const filtered = useMemo(() => {
    if (!search.trim()) return displayProducts
    const q = search.toLowerCase()
    return displayProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    )
  }, [displayProducts, search])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          closing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-[28px] border border-white/10 bg-[var(--shop-panel)] pb-safe-bottom shadow-[0_-12px_60px_rgba(0,0,0,0.5)] transition-all duration-200 sm:mx-4 sm:max-w-lg sm:rounded-[28px] ${
          closing
            ? 'translate-y-8 opacity-0 sm:translate-y-4 sm:scale-95'
            : 'translate-y-0 opacity-100'
        }`}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Select Product
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)] transition-colors hover:bg-white/12"
          >
            Cancel
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-white/10 px-5 py-3">
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 text-[var(--shop-muted)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
          <g transform="translate(4, 4)">

              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l4 4" />
            
          </g>
        </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID, or category..."
              className="w-full rounded-xl border border-white/10 bg-white/8 py-2.5 pl-10 pr-3 text-sm text-[var(--shop-cream)] placeholder:text-[var(--shop-muted)]/60 outline-none transition-colors focus:border-[var(--shop-purple)]/40"
            />
          </div>
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--shop-purple)] border-t-transparent" />
              <span className="ml-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Loading products...
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--shop-muted)]">
              {search.trim()
                ? 'No products match your search.'
                : 'No products yet.'}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleSelect(product)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition-colors hover:bg-white/10 active:bg-white/12"
                >
                  {/* Thumbnail */}
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    {'images' in product && product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : 'image' in product && product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-6 w-6 shrink-0 text-[var(--shop-muted)]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
          <g transform="translate(2, 2)">

                          <rect x="2" y="2" width="16" height="16" rx="3" />
                          <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
                          <path d="M2 14l5-5 4 4 3-3 4 4" />
                        
          </g>
        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">
                      {product.name}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-mono text-[var(--shop-muted)]">
                      {product.id}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-block rounded-full bg-[var(--shop-purple)]/12 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-purple)]">
                        {product.category}
                      </span>
                      {'isAvailable' in product && product.isAvailable ? (
                        <span className="inline-block rounded-full bg-emerald-300/12 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
                          Active
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-white/8 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-muted)]">
                          {cachedProducts ? 'Available' : 'Sold'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 text-[var(--shop-muted)]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
          <g transform="translate(4, 4)">

                    <path d="M6 3l5 5-5 5" />
                  
          </g>
        </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
