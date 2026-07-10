import { useRef, useState } from 'react'

import type { Product, ProductCategory } from '../../types/product'

type StoreCatalogPanelProps = {
  storeScreen: 'catalog' | 'likes'
  isLoading: boolean
  errorMessage: string | null
  products: Product[]
  sortedProducts: Product[]
  selectedProductId: string | null
  validLikedProductIds: string[]
  likedProductIds: string[]
  categoryOptions: Array<'all' | ProductCategory>
  selectedCategory: 'all' | ProductCategory
  storeCollectionView: 'all' | 'liked'
  storeSortMode: 'latest' | 'trending'
  storeSearchQuery: string
  onSearchChange: (value: string) => void
  onSelectCollectionView: (view: 'all' | 'liked') => void
  onSelectSortMode: (mode: 'latest' | 'trending') => void
  onSelectCategory: (category: 'all' | ProductCategory) => void
  onResetFilters: () => void
  onOpenLikes: () => void
  onOpenProduct: (productId: string) => void
  onOpenLikedProduct: (productId: string) => void
  onToggleLike: (product: Product) => void
}

export function StoreCatalogPanel({
  isLoading,
  errorMessage,
  products,
  sortedProducts,
  selectedProductId,
  validLikedProductIds,
  likedProductIds,
  categoryOptions,
  selectedCategory,
  storeCollectionView,
  storeSortMode,
  storeSearchQuery,
  onSearchChange,
  onSelectCollectionView,
  onSelectSortMode,
  onSelectCategory,
  onResetFilters,
  onOpenLikes,
  onOpenProduct,
  onOpenLikedProduct,
  onToggleLike,
}: StoreCatalogPanelProps) {
  const likedProductIdSet = new Set(likedProductIds)
  const normalizedSearch = storeSearchQuery.trim()
  const hasActiveFilters =
    normalizedSearch.length > 0 ||
    selectedCategory !== 'all' ||
    storeCollectionView !== 'all' ||
    storeSortMode !== 'latest'
  const [showFilters, setShowFilters] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  return (
    <>
      {!isLoading && !errorMessage && validLikedProductIds.length > 0 ? (
        <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.16),rgba(255,77,90,0.1))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/70">
              Liked Pieces
            </p>
            <button
              type="button"
              onClick={onOpenLikes}
              className="rounded-full bg-white/12 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
            >
              Open Liked
            </button>
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {products
              .filter((product) => likedProductIdSet.has(product.id))
              .slice(0, 6)
              .map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onOpenLikedProduct(product.id)}
                  className="w-24 shrink-0 text-left"
                >
                  <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/20">
                    <div className="aspect-[3/4] w-full overflow-hidden">
                      {product.images[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          loading="lazy"
                          className={`h-full w-full object-cover ${product.isAvailable ? '' : 'grayscale'}`}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                          No Image
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--shop-cream)]">
                    {product.name}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                    {product.price} {product.currency}
                  </p>
                </button>
              ))}
          </div>
        </article>
      ) : null}

      <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        {/* Toolbar: Search + Filter + Results */}
        <div className="flex items-center gap-2">
          {/* Search toggle */}
          <button
            type="button"
            onClick={() => {
              setShowSearch((prev) => !prev)
              if (showSearch) onSearchChange('')
            }}
            className={`rounded-2xl p-3 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
              showSearch || normalizedSearch
                ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                : 'bg-white/8 text-[var(--shop-muted)]'
            }`}
            aria-label="Toggle search"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className={`rounded-2xl p-3 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                : 'bg-white/8 text-[var(--shop-muted)]'
            }`}
            aria-label="Toggle filters"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z"
                clipRule="evenodd"
              />
            </svg>
            {hasActiveFilters && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--shop-red)]" />
            )}
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Reset when filters active */}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              className="rounded-2xl bg-white/8 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
            >
              Clear
            </button>
          ) : null}

          {/* Results count — minimal */}
          {!isLoading && !errorMessage && products.length > 0 ? (
            <span className="rounded-2xl bg-white/6 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
              {sortedProducts.length}
              <span className="hidden sm:inline"> / {products.length}</span>
            </span>
          ) : null}
        </div>

        {/* Expandable search input */}
        {showSearch ? (
          <div className="mt-3">
            <input
              value={storeSearchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search product, brand..."
              autoFocus
              className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-[var(--shop-cream)] outline-none transition placeholder:text-[var(--shop-muted)]/70 focus:border-[var(--shop-red)]"
            />
          </div>
        ) : null}

        {/* Expandable filter panel */}
        {showFilters ? (
          <div className="mt-3 space-y-2">
            {/* Collection view */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(
                [
                  ['all', 'All'],
                  ['liked', `Liked ${validLikedProductIds.length}`],
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => onSelectCollectionView(view)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] whitespace-nowrap transition-colors ${
                    storeCollectionView === view
                      ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                      : 'bg-white/8 text-[var(--shop-muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}

              {/* Sort */}
              {(
                [
                  ['latest', 'Latest'],
                  ['trending', 'Trending'],
                ] as const
              ).map(([sortMode, label]) => (
                <button
                  key={sortMode}
                  type="button"
                  onClick={() => onSelectSortMode(sortMode)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] whitespace-nowrap transition-colors ${
                    storeSortMode === sortMode
                      ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                      : 'bg-white/8 text-[var(--shop-muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categoryOptions.map((category) => {
                const isActive = selectedCategory === category

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => onSelectCategory(category)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                        : 'bg-white/8 text-[var(--shop-muted)]'
                    }`}
                  >
                    {category}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* Product area */}
        <div className="mt-5">
          {isLoading ? (
            <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
              Loading products...
            </p>
          ) : null}

          {!isLoading && errorMessage ? (
            <p className="rounded-2xl bg-[var(--shop-red)]/16 px-4 py-3 text-sm text-[var(--shop-cream)]">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && !errorMessage && products.length === 0 ? (
            <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
              The drop is empty right now.
            </p>
          ) : null}

          {!isLoading && !errorMessage && sortedProducts.length === 0 && products.length > 0 ? (
            <div className="rounded-2xl bg-white/8 px-4 py-4 text-sm text-[var(--shop-muted)]">
              <p>No matches.</p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="mt-3 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
                >
                  Clear Filters
                </button>
              ) : null}
            </div>
          ) : null}

          {!isLoading && !errorMessage && sortedProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {sortedProducts.map((product) => (
                <CatalogProductCard
                  key={product.id}
                  product={product}
                  isSelected={selectedProductId === product.id}
                  isLiked={likedProductIdSet.has(product.id)}
                  onOpenProduct={onOpenProduct}
                  onToggleLike={onToggleLike}
                />
              ))}
            </div>
          ) : null}
        </div>
      </article>
    </>
  )
}

function getProductHeatScore(product: Product) {
  return product.likesCount + product.cartCount * 2
}

type CatalogProductCardProps = {
  product: Product
  isSelected: boolean
  isLiked: boolean
  onOpenProduct: (productId: string) => void
  onToggleLike: (product: Product) => void
}

function CatalogProductCard({
  product,
  isSelected,
  isLiked,
  onOpenProduct,
  onToggleLike,
}: CatalogProductCardProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const pointerStartXRef = useRef<number | null>(null)
  const didSwipeRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)
  const heatScore = getProductHeatScore(product)
  const selectedImage = product.images[selectedImageIndex] ?? product.images[0] ?? null

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

  return (
    <article
      className={`overflow-hidden rounded-[28px] border bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition-transform ${
        isSelected
          ? 'border-[var(--shop-red)] ring-2 ring-[var(--shop-red)]/30'
          : 'border-white/10'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false
            return
          }

          onOpenProduct(product.id)
        }}
        className="w-full text-left"
      >
        <div
          className="relative aspect-square w-full overflow-hidden bg-black/20"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            activePointerIdRef.current = event.pointerId
            pointerStartXRef.current = event.clientX
            didSwipeRef.current = false
          }}
          onPointerMove={(event) => {
            if (
              activePointerIdRef.current !== event.pointerId ||
              pointerStartXRef.current === null
            ) {
              return
            }

            const deltaX = event.clientX - pointerStartXRef.current

            if (Math.abs(deltaX) < 35) {
              return
            }

            didSwipeRef.current = true
            pointerStartXRef.current = event.clientX

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
            pointerStartXRef.current = null
          }}
          onPointerCancel={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }

            activePointerIdRef.current = null
            pointerStartXRef.current = null
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              void onToggleLike(product)
            }}
            className={`absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur ${
              isLiked
                ? 'bg-[var(--shop-red)] text-white'
                : 'bg-black/35 text-[var(--shop-cream)]'
            }`}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-6.7-4.4-9.2-8.1C.8 10 .9 6.5 3.6 4.7c2.2-1.5 5.1-.8 6.8 1.3C12 3.9 14.8 3.2 17 4.7c2.7 1.8 2.8 5.3.8 8.2C18.7 14.2 12 21 12 21Z" />
            </svg>
          </button>

          {selectedImage ? (
            <img
              src={selectedImage}
              alt={product.name}
              loading="lazy"
              className={`h-full w-full object-cover transition ${product.isAvailable ? '' : 'grayscale'}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              No Image
            </div>
          )}
          {product.isLimitedLabel ? (
            <span className="absolute left-3 top-3 rounded-full bg-[var(--shop-red)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
              {product.isLimitedLabel}
            </span>
          ) : null}
          {heatScore >= 3 ? (
            <span className="absolute right-3 top-14 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--shop-purple)]/90 text-white" aria-label="Trending hot">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <path fillRule="evenodd" d="M13.5 4.938a7 7 0 11-9.006 1.737c.202-.257.59-.218.793.039.278.352.594.672.943.954.332.269.786-.049.773-.476a5.977 5.977 0 01.572-2.759 6.02 6.02 0 012.286-2.624c.248-.162.543-.023.565.222.042.446.164.883.363 1.285.348.702.855 1.29 1.482 1.697.626.407 1.35.63 2.105.635.1.006.225-.006.31-.066a.485.485 0 00.145-.38 6.055 6.055 0 01.422-2.448 6.1 6.1 0 01.932-1.601c.18-.228.525-.13.596.126a6.944 6.944 0 01.466 2.368z" clipRule="evenodd" />
              </svg>
            </span>
          ) : null}
          {product.images.length > 1 ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-between px-3">
              <span className="rounded-full bg-black/35 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-cream)]">
                {selectedImageIndex + 1}/{product.images.length}
              </span>
            </div>
          ) : null}
          {!product.isAvailable ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <span className="rounded-full border border-white/20 bg-black/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white backdrop-blur">
                Sold
              </span>
            </div>
          ) : null}
        </div>
        <div className="px-3 pb-4 pt-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-2 text-base font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
                {product.name}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                {product.brandNames.join(' - ') || product.category}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
              {product.price} {product.currency}
            </span>
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
        </div>
      </button>
    </article>
  )
}
