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
  storeScreen,
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

  return (
    <>
      {!isLoading && !errorMessage && validLikedProductIds.length > 0 ? (
        <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.16),rgba(255,77,90,0.1))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/70">
                Liked Pieces
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--shop-muted)]">
                Jump back into the pieces you already watched before someone else grabs them.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenLikes}
              className="w-fit rounded-full bg-white/12 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
              {storeScreen === 'likes' ? 'Likes' : 'Catalog'}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
              {storeScreen === 'likes'
                ? 'Your watched pieces live here. Tap any one to open the focused product view and decide before it disappears.'
                : 'Image-first drop grid. Tap any piece to open the focused product view, then switch the sort to push the hottest pieces to the top.'}
            </p>
          </div>
          <span className="w-fit rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-cream)]">
            2-Column
          </span>
        </div>

        {!isLoading && !errorMessage && products.length > 0 ? (
          <div className="mt-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                Search
              </span>
              <input
                value={storeSearchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search by product, brand, or category"
                className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-[var(--shop-cream)] outline-none transition placeholder:text-[var(--shop-muted)]/70 focus:border-[var(--shop-red)]"
              />
            </label>
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {(
                [
                  ['all', 'All Pieces'],
                  ['liked', `Liked ${validLikedProductIds.length}`],
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => onSelectCollectionView(view)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                    storeCollectionView === view
                      ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                      : 'bg-white/8 text-[var(--shop-muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {(
                [
                  ['latest', 'Latest First'],
                  ['trending', 'Trending'],
                ] as const
              ).map(([sortMode, label]) => (
                <button
                  key={sortMode}
                  type="button"
                  onClick={() => onSelectSortMode(sortMode)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                    storeSortMode === sortMode
                      ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                      : 'bg-white/8 text-[var(--shop-muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {categoryOptions.map((category) => {
                const isActive = selectedCategory === category

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => onSelectCategory(category)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
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
            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/6 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                    Results
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--shop-cream)]">
                    Showing {sortedProducts.length} of {products.length} products
                  </p>
                </div>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="w-fit rounded-full border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
                  >
                    Clear All
                  </button>
                ) : null}
              </div>

              {hasActiveFilters ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {normalizedSearch ? (
                    <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]">
                      Search: {normalizedSearch}
                    </span>
                  ) : null}
                  {storeCollectionView === 'liked' ? (
                    <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]">
                      Collection: Liked
                    </span>
                  ) : null}
                  {selectedCategory !== 'all' ? (
                    <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]">
                      Category: {selectedCategory}
                    </span>
                  ) : null}
                  {storeSortMode === 'trending' ? (
                    <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]">
                      Sort: Trending
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                  Fresh drop view with no active filters.
                </p>
              )}
            </div>
          </div>
        ) : null}

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
              No products found yet. Add a document to the <code>products</code> collection to see it here.
            </p>
          ) : null}

          {!isLoading && !errorMessage && sortedProducts.length === 0 ? (
            <div className="rounded-2xl bg-white/8 px-4 py-4 text-sm text-[var(--shop-muted)]">
              <p>
                {storeCollectionView === 'liked'
                  ? 'No liked products match your current search or category yet.'
                  : 'No products match your current search or category.'}
              </p>
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
  const supportsTouchSwipe =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
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
          style={{ touchAction: supportsTouchSwipe ? 'pan-y' : 'auto' }}
          onPointerDown={(event) => {
            if (!supportsTouchSwipe) {
              return
            }

            event.currentTarget.setPointerCapture(event.pointerId)
            activePointerIdRef.current = event.pointerId
            pointerStartXRef.current = event.clientX
            didSwipeRef.current = false
          }}
          onPointerMove={(event) => {
            if (!supportsTouchSwipe) {
              return
            }

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
            if (!supportsTouchSwipe) {
              return
            }

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }

            activePointerIdRef.current = null
            pointerStartXRef.current = null
          }}
          onPointerCancel={(event) => {
            if (!supportsTouchSwipe) {
              return
            }

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
            className={`absolute right-3 top-3 z-10 rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] backdrop-blur ${
              isLiked
                ? 'bg-[var(--shop-red)] text-white'
                : 'bg-black/35 text-[var(--shop-cream)]'
            }`}
          >
            Love
          </button>

          {selectedImage ? (
            <img
              src={selectedImage}
              alt={product.name}
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
            <span className="absolute left-3 top-12 rounded-full bg-[var(--shop-purple)]/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
              Hot Now
            </span>
          ) : null}
          {supportsTouchSwipe && product.images.length > 1 ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-between px-3">
              <span className="rounded-full bg-black/35 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-cream)]">
                Swipe Photos
              </span>
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
        <div className="space-y-3 px-3 pb-4 pt-3">
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

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
            <span>{product.likesCount} loves</span>
            <span>{product.cartCount} in carts</span>
          </div>

          {heatScore > 0 ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]/85">
              {product.cartCount > 0
                ? `${product.cartCount} people already added this piece`
                : `${product.likesCount} watchers on this piece`}
            </p>
          ) : (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Fresh in the current drop
            </p>
          )}
        </div>
      </button>
    </article>
  )
}
