import { useEffect, useMemo, useRef, useState } from 'react'

import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import type { BannerSlide } from '../../types/bannerSlide'
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
  onRefresh?: () => void
  onToggleLike: (product: Product) => void
  bannerSlides?: BannerSlide[]
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
  onSelectCollectionView: _onSelectCollectionView,
  onSelectSortMode,
  onSelectCategory,
  onResetFilters,
  onOpenLikes,
  onOpenProduct,
  onOpenLikedProduct,
  onRefresh,
  onToggleLike,
  bannerSlides,
}: StoreCatalogPanelProps) {
  const likedProductIdSet = new Set(likedProductIds)
  const normalizedSearch = storeSearchQuery.trim()
  const hasActiveFilters =
    normalizedSearch.length > 0 ||
    selectedCategory !== 'all' ||
    storeCollectionView !== 'all' ||
    storeSortMode !== 'latest'
  const [showFilters, setShowFilters] = useState(false)

  const [searchInputValue, setSearchInputValue] = useState('')

  // Pull-to-refresh gesture state
  const [pullDistance, setPullDistance] = useState(0)
  const pullStartYRef = useRef<number | null>(null)
  const isRefreshingRef = useRef(false)
  const PULL_THRESHOLD = 80

  // "Updated just now" label after successful refresh
  const [refreshLabel, setRefreshLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!refreshLabel) return

    const timer = setTimeout(() => {
      setRefreshLabel(null)
    }, 2500)

    return () => clearTimeout(timer)
  }, [refreshLabel])

  // Sync the local input value when the parent storeSearchQuery changes
  useEffect(() => {
    setSearchInputValue(storeSearchQuery)
  }, [storeSearchQuery])

  // Debounce: wait 300ms after the user stops typing before filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInputValue !== storeSearchQuery) {
        onSearchChange(searchInputValue)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInputValue])

  // ── Hero carousel state ──
  const [activeCampaignIndex, setActiveCampaignIndex] = useState(0)
  const campaignPointerStartRef = useRef<number | null>(null)
  const campaignIsPausedRef = useRef(false)

  const CAMPAIGN_SLIDES = useMemo(() => {
    if (bannerSlides && bannerSlides.length > 0) {
      return bannerSlides.filter((s) => s.isActive).map((s) => ({
        badgeText: s.badgeText,
        headline: s.headline,
        subheading: s.subheading,
        caption: s.caption,
      }))
    }

    return [
      {
        badgeText: products.filter((p) => p.isAvailable).length > 0 ? 'Live Now' : 'Coming Soon',
        headline: 'DROP 01',
        subheading: 'AVAILABLE NOW',
        caption: 'Limited pieces • First come, first served',
      },
      {
        badgeText: products.filter((p) => p.isAvailable).length > 0 ? 'New Arrivals' : 'Next Drop',
        headline: 'FRESH',
        subheading: 'NEW ARRIVALS',
        caption: 'Latest pieces added to the collection',
      },
      {
        badgeText: 'Limited Edition',
        headline: 'EXCLUSIVE',
        subheading: 'ONE-OF-ONE',
        caption: 'Unique pieces you will not find elsewhere',
      },
    ]
  }, [bannerSlides, products])

  // Auto-advance carousel
  useEffect(() => {
    if (campaignIsPausedRef.current) return

    const timer = setInterval(() => {
      setActiveCampaignIndex((prev) => (prev + 1) % CAMPAIGN_SLIDES.length)
    }, 4000)

    return () => clearInterval(timer)
  }, [])

  function handleCampaignPointerDown(clientX: number) {
    campaignIsPausedRef.current = true
    campaignPointerStartRef.current = clientX
  }

  function handleCampaignPointerEnd(clientX: number) {
    if (campaignPointerStartRef.current === null) {
      campaignIsPausedRef.current = false
      return
    }

    const deltaX = clientX - campaignPointerStartRef.current
    campaignPointerStartRef.current = null
    campaignIsPausedRef.current = false

    if (Math.abs(deltaX) < 40) return

    if (deltaX < 0) {
      setActiveCampaignIndex((prev) => (prev + 1) % CAMPAIGN_SLIDES.length)
    } else {
      setActiveCampaignIndex(
        (prev) => (prev - 1 + CAMPAIGN_SLIDES.length) % CAMPAIGN_SLIDES.length,
      )
    }
  }

  const currentCampaign = CAMPAIGN_SLIDES[activeCampaignIndex]

  // Handle pull-to-refresh
  async function handlePullEnd() {
    if (pullDistance >= PULL_THRESHOLD && onRefresh && !isRefreshingRef.current) {
      isRefreshingRef.current = true
      triggerHapticFeedback('medium')
      setPullDistance(0)
      await onRefresh()
      isRefreshingRef.current = false
      setRefreshLabel('Updated just now')
    } else {
      setPullDistance(0)
    }
  }

  return (
    <>
      {/* ── Pull-to-refresh catcher ── */}
      <div
        className="-mx-5 -mt-5 h-2 w-[calc(100%+40px)]"
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          if (window.scrollY > 0 || isRefreshingRef.current) return
          event.currentTarget.setPointerCapture(event.pointerId)
          pullStartYRef.current = event.clientY
          setPullDistance(0)
        }}
        onPointerMove={(event) => {
          if (pullStartYRef.current === null || isRefreshingRef.current) return
          const deltaY = event.clientY - pullStartYRef.current
          if (deltaY < 0) {
            setPullDistance(0)
            return
          }
          setPullDistance(Math.min(deltaY, PULL_THRESHOLD + 20))
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          pullStartYRef.current = null
          void handlePullEnd()
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          pullStartYRef.current = null
          setPullDistance(0)
        }}
      />

      {/* ── Pull indicator ── */}
      <div
        className="pointer-events-none flex justify-center transition-all duration-100 ease-out"
        style={{
          height: pullDistance,
          opacity: pullDistance > 0 ? Math.min(pullDistance / PULL_THRESHOLD, 1) : 0,
          marginBottom: pullDistance > 0 ? -pullDistance : 0,
        }}
      >
        <div className="flex items-center gap-2">
          {pullDistance >= PULL_THRESHOLD ? (
            <>
              <svg className="h-4 w-4 animate-bounce text-[var(--shop-cream)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-cream)]">Release to refresh</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4 text-[var(--shop-muted)] transition-transform" style={{ transform: `rotate(${pullDistance * 2}deg)` }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="m19 12-7 7-7-7" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">Pull to refresh</span>
            </>
          )}
        </div>
      </div>

      {/* ── Updated toast ── */}
      <div className={`flex justify-center overflow-hidden transition-all duration-300 ease-out ${refreshLabel ? 'mb-3 max-h-8 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-300/15 px-3 py-1.5">
          <svg className="h-3 w-3 text-emerald-100" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm3.36 4.65a.5.5 0 00-.72-.7l-3.5 3.6-1.35-1.32a.5.5 0 10-.7.7l1.7 1.68a.5.5 0 00.7 0l3.87-3.96z" />
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">{refreshLabel}</span>
        </div>
      </div>

      {/* ── Liked Pieces section ── */}
      {!isLoading && !errorMessage && validLikedProductIds.length > 0 ? (
        <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.16),rgba(255,77,90,0.1))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/70">Liked Pieces</p>
            <button type="button" onClick={onOpenLikes} className="rounded-full bg-white/12 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">Open Liked</button>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {products.filter((product) => likedProductIdSet.has(product.id)).slice(0, 6).map((product) => (
              <button key={product.id} type="button" onClick={() => onOpenLikedProduct(product.id)} className="w-24 shrink-0 text-left">
                <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/20">
                  <div className="aspect-[3/4] w-full overflow-hidden">
                    {product.images[0] ? (
                      <img src={product.images[0]} alt={product.name} loading="lazy" className={`h-full w-full object-cover ${product.isAvailable ? '' : 'grayscale opacity-60'}`} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] uppercase tracking-[0.16em] text-[var(--shop-muted)]">No Image</div>
                    )}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--shop-cream)]">{product.name}</p>
                <p className={`mt-1 text-[10px] uppercase tracking-[0.16em] ${product.isAvailable ? 'text-[var(--shop-muted)]' : 'text-[var(--shop-muted)]/50 line-through'}`}>{product.price} {product.currency}</p>
              </button>
            ))}
          </div>
        </article>
      ) : null}

      {/* ── HERO CAMPAIGN CAROUSEL ── */}
      <div
        className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(28,14,34,0.95),rgba(139,61,255,0.2),rgba(255,77,90,0.15))] shadow-[0_18px_45px_rgba(0,0,0,0.3)]"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          handleCampaignPointerDown(event.clientX)
        }}
        onPointerMove={(event) => {
          if (campaignPointerStartRef.current === null) return
          const deltaX = event.clientX - campaignPointerStartRef.current
          if (Math.abs(deltaX) < 40) return
          campaignPointerStartRef.current = event.clientX
          if (deltaX < 0) {
            setActiveCampaignIndex((prev) => (prev + 1) % CAMPAIGN_SLIDES.length)
          } else {
            setActiveCampaignIndex(
              (prev) => (prev - 1 + CAMPAIGN_SLIDES.length) % CAMPAIGN_SLIDES.length,
            )
          }
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          handleCampaignPointerEnd(event.clientX)
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          campaignPointerStartRef.current = null
          campaignIsPausedRef.current = false
        }}
      >
        {/* Decorative texture lines */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
          <div className="absolute left-1/4 top-0 h-full w-px bg-white" />
          <div className="absolute left-2/4 top-0 h-full w-px bg-white" />
          <div className="absolute left-3/4 top-0 h-full w-px bg-white" />
          <div className="absolute top-1/3 left-0 h-px w-full bg-white" />
          <div className="absolute top-2/3 left-0 h-px w-full bg-white" />
        </div>

        {/* Slide content with crossfade */}
        <div className="relative flex aspect-[16/9] flex-col items-start justify-end p-6 sm:p-8">
          <span
            key={`badge-${activeCampaignIndex}`}
            className="mb-2 animate-[fade-slide-in_0.4s_ease-out_backwards] inline-block rounded-full bg-white/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/70"
          >
            {currentCampaign.badgeText}
          </span>
          <h3
            key={`headline-${activeCampaignIndex}`}
            className="animate-[fade-slide-in_0.4s_ease-out_backwards] text-2xl font-black uppercase leading-none tracking-[-0.04em] text-white sm:text-3xl"
          >
            {currentCampaign.headline}
            <br />
            <span className="text-[var(--shop-purple)]">{currentCampaign.subheading}</span>
          </h3>
          <p
            key={`caption-${activeCampaignIndex}`}
            className="animate-[fade-slide-in_0.4s_ease-out_backwards] mt-2 max-w-xs text-xs font-medium uppercase tracking-[0.18em] text-white/60"
          >
            {currentCampaign.caption}
          </p>
        </div>

        {/* Carousel dot indicators */}
        {CAMPAIGN_SLIDES.length > 1 ? (
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
            {CAMPAIGN_SLIDES.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setActiveCampaignIndex(index)
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === activeCampaignIndex
                    ? 'w-4 bg-white'
                    : 'w-1.5 bg-white/30'
                }`}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* ── SEARCH BAR (always visible) ── */}
      <div className="relative flex items-center rounded-2xl border border-white/10 bg-[var(--shop-panel)] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
        <svg viewBox="0 0 20 20" fill="currentColor" className="mr-3 h-4 w-4 shrink-0 text-[var(--shop-muted)]" aria-hidden="true">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
        <input
          value={searchInputValue}
          onChange={(event) => setSearchInputValue(event.target.value)}
          placeholder="Search items..."
          className="flex-1 bg-transparent text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60"
        />
        <button
          type="button"
          onClick={() => {
            setShowFilters((prev) => !prev)
            triggerHapticFeedback('light')
          }}
          className={`relative ml-2 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            showFilters || hasActiveFilters ? 'bg-white/10 text-white' : 'text-[var(--shop-muted)]'
          }`}
          aria-label="Toggle filters"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
          </svg>
          {hasActiveFilters && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--shop-red)]" />
          )}
        </button>
      </div>

      {/* ── EXPANDABLE FILTER PANEL ── */}
      {showFilters ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--shop-panel)] p-4">
          {/* Sort — borderless text tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {([['latest', 'Latest'], ['trending', 'Trending']] as const).map(([sortMode, label]) => (
              <button
                key={sortMode}
                type="button"
                onClick={() => onSelectSortMode(sortMode)}
                className={`relative shrink-0 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] whitespace-nowrap transition-colors ${
                  storeSortMode === sortMode ? 'text-white' : 'text-[var(--shop-muted)]'
                }`}
              >
                {label}
                {storeSortMode === sortMode ? (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-white" />
                ) : null}
              </button>
            ))}
          </div>

          {/* Categories — flat pills */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {categoryOptions.map((category) => {
              const isActive = selectedCategory === category
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onSelectCategory(category)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] whitespace-nowrap transition-colors ${
                    isActive ? 'bg-white text-black' : 'bg-white/8 text-[var(--shop-muted)]'
                  }`}
                >
                  {category}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* ── PRODUCT AREA ── */}
      <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        {/* Results header */}
        {!isLoading && !errorMessage && products.length > 0 ? (
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              {sortedProducts.length} {sortedProducts.length === 1 ? 'Piece' : 'Pieces'}
            </span>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={onResetFilters}
                className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]"
              >
                Clear All
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Loading state */}
        {isLoading ? (
          <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">Loading products...</p>
        ) : null}

        {/* Error state */}
        {!isLoading && errorMessage ? (
          <p className="rounded-2xl bg-[var(--shop-red)]/16 px-4 py-3 text-sm text-[var(--shop-cream)]">{errorMessage}</p>
        ) : null}

        {/* Empty state */}
        {!isLoading && !errorMessage && products.length === 0 ? (
          <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">The drop is empty right now.</p>
        ) : null}

        {/* No matches state */}
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

        {/* Product grid */}
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
    if (product.images.length <= 1) return
    setSelectedImageIndex((currentIndex) => {
      if (direction === 'prev') return currentIndex === 0 ? product.images.length - 1 : currentIndex - 1
      return currentIndex === product.images.length - 1 ? 0 : currentIndex + 1
    })
  }

  return (
    <article
      className={`overflow-hidden rounded-[28px] border bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition-transform ${
        isSelected ? 'border-[var(--shop-red)] ring-2 ring-[var(--shop-red)]/30' : 'border-white/10'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false
            return
          }
          onOpenProduct(product.id)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpenProduct(product.id)
          }
        }}
        className="w-full cursor-pointer text-left outline-none"
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
            if (activePointerIdRef.current !== event.pointerId || pointerStartXRef.current === null) return
            const deltaX = event.clientX - pointerStartXRef.current
            if (Math.abs(deltaX) < 35) return
            didSwipeRef.current = true
            pointerStartXRef.current = event.clientX
            if (deltaX < 0) { moveGallery('next'); return }
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
          {/* Story-style segmented progress bar at top edge */}
          {product.images.length > 1 ? (
            <div className="absolute inset-x-0 top-0 z-20 flex gap-0.5 p-1">
              {product.images.map((_, index) => (
                <div
                  key={index}
                  className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                    index <= selectedImageIndex ? 'bg-white' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          ) : null}

          {/* Like button */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              triggerHapticFeedback('light')
              void onToggleLike(product)
            }}
            className={`absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur ${
              isLiked ? 'bg-[var(--shop-red)] text-white' : 'bg-black/35 text-[var(--shop-cream)]'
            }`}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-6.7-4.4-9.2-8.1C.8 10 .9 6.5 3.6 4.7c2.2-1.5 5.1-.8 6.8 1.3C12 3.9 14.8 3.2 17 4.7c2.7 1.8 2.8 5.3.8 8.2C18.7 14.2 12 21 12 21Z" />
            </svg>
          </button>

          {/* Product image */}
          {selectedImage ? (
            <img
              src={selectedImage}
              alt={product.name}
              loading="lazy"
              className={`h-full w-full object-cover transition-all duration-300 ${product.isAvailable ? '' : 'grayscale opacity-60'}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">No Image</div>
          )}

          {/* Limited label */}
          {product.isLimitedLabel && product.isAvailable ? (
            <span className="absolute left-3 top-3 rounded-full bg-[var(--shop-red)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">{product.isLimitedLabel}</span>
          ) : null}

          {/* Heat badge */}
          {heatScore >= 3 && product.isAvailable ? (
            <span className="absolute right-3 top-14 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--shop-purple)]/90 text-white" aria-label="Trending hot">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <path fillRule="evenodd" d="M13.5 4.938a7 7 0 11-9.006 1.737c.202-.257.59-.218.793.039.278.352.594.672.943.954.332.269.786-.049.773-.476a5.977 5.977 0 01.572-2.759 6.02 6.02 0 012.286-2.624c.248-.162.543-.023.565.222.042.446.164.883.363 1.285.348.702.855 1.29 1.482 1.697.626.407 1.35.63 2.105.635.1.006.225-.006.31-.066a.485.485 0 00.145-.38 6.055 6.055 0 01.422-2.448 6.1 6.1 0 01.932-1.601c.18-.228.525-.13.596.126a6.944 6.944 0 01.466 2.368z" clipRule="evenodd" />
              </svg>
            </span>
          ) : null}
        </div>

        {/* Info section */}
        <div className="px-3 pb-4 pt-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`line-clamp-2 text-base font-semibold tracking-[-0.03em] ${product.isAvailable ? 'text-[var(--shop-cream)]' : 'text-[var(--shop-muted)]/70'}`}>
                {product.name}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                {product.brandNames.join(' - ') || product.category}
              </p>
            </div>
            <span className={`shrink-0 text-sm font-semibold tracking-[-0.03em] ${product.isAvailable ? 'text-[var(--shop-cream)]' : 'text-[var(--shop-muted)]/50 line-through'}`}>
              {product.price} {product.currency}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}