import { useEffect, useMemo, useRef, useState } from 'react'

import { triggerHapticFeedback, triggerHapticNotification, triggerHapticSelection } from '../../lib/telegram/webApp'
import { getProductAccessLevel } from '../../lib/earlyAccess'
import { SkeletonProductGrid } from '../ui/SkeletonCard'
import { QuickViewSheet } from './QuickViewSheet'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useNotifySubscription } from '../../hooks/useNotifySubscription'
import type { Campaign } from '../../types/campaign'
import type { CartItem } from '../../types/cart'
import type { Product, ProductCategory } from '../../types/product'

type StoreCatalogPanelProps = {
  storeScreen: 'catalog' | 'likes'
  isLoading: boolean
  errorMessage: string | null
  products: Product[]
  sortedProducts: Product[]
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
  onOpenProduct: (productId: string) => void
  onRefresh?: () => void
  onToggleLike: (product: Product) => void
  onAddToCart: (product: Product) => void
  onRemoveFromCart: (productId: string) => void
  cartItems: CartItem[]
  initData: string
  campaigns?: Campaign[]
  onQuickViewChange?: (isOpen: boolean) => void
}

export function StoreCatalogPanel({
  isLoading,
  errorMessage,
  products,
  sortedProducts,
  likedProductIds,
  storeScreen,
  categoryOptions,
  selectedCategory,
  storeCollectionView,
  storeSortMode,
  storeSearchQuery,
  onSearchChange,
  onSelectSortMode,
  onSelectCategory,
  onResetFilters,
  onOpenProduct,
  onRefresh,
  onToggleLike,
  onAddToCart,
  onRemoveFromCart,
  cartItems,
  initData,
  campaigns,
  onQuickViewChange,
}: StoreCatalogPanelProps) {
  const likedProductIdSet = new Set(likedProductIds)
  const normalizedSearch = storeSearchQuery.trim()
  const hasActiveFilters =
    normalizedSearch.length > 0 ||
    selectedCategory !== 'all' ||
    storeCollectionView !== 'all' ||
    storeSortMode !== 'latest'
  // Red dot only lights up for filter menu selections, not search text
  const hasFilterMenuSelections =
    selectedCategory !== 'all' ||
    storeCollectionView !== 'all' ||
    storeSortMode !== 'latest'
  const [showFilters, setShowFilters] = useState(false)

  // Quick view bottom sheet state
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)

  // Notify parent when quick view opens/closes
  useEffect(() => {
    if (onQuickViewChange) {
      onQuickViewChange(quickViewProduct !== null)
    }
  }, [quickViewProduct, onQuickViewChange])
  const cartProductIdSet = useMemo(() => new Set(cartItems.map((i) => i.productId)), [cartItems])

  const [searchInputValue, setSearchInputValue] = useState('')
  const reducedMotion = useReducedMotion()
  const { isSubscribed, subscribe, unsubscribe } = useNotifySubscription(initData)
  const reducedMotionRef = useRef(reducedMotion)
  reducedMotionRef.current = reducedMotion

  // First-load stagger animation tracking — skip when reduced motion is active
  const [isFirstLoad, setIsFirstLoad] = useState(!reducedMotion)

  useEffect(() => {
    if (reducedMotion) {
      setIsFirstLoad(false)
      return
    }
    if (!isLoading && isFirstLoad) {
      const timer = setTimeout(() => setIsFirstLoad(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [isLoading, isFirstLoad, reducedMotion])

  // Pull-to-refresh gesture state
  const [pullDistance, setPullDistance] = useState(0)
  const pullDistanceRef = useRef(0)
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

  // Document-level pull-to-refresh with activePointerId tracking
  useEffect(() => {
    let activePointerId: number | null = null

    function handlePointerDown(event: PointerEvent) {
      if (window.scrollY > 0 || isRefreshingRef.current || activePointerId !== null) return
      if (event.clientY > 60) return

      activePointerId = event.pointerId
      pullStartYRef.current = event.clientY
      setPullDistance(0)
      pullDistanceRef.current = 0
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activePointerId || pullStartYRef.current === null) return

      const deltaY = event.clientY - pullStartYRef.current
      if (deltaY <= 0) {
        setPullDistance(0)
        pullDistanceRef.current = 0
        return
      }
      const clamped = Math.min(deltaY, PULL_THRESHOLD + 20)
      setPullDistance(clamped)
      pullDistanceRef.current = clamped
    }

    function handlePointerEnd(event: PointerEvent) {
      if (event.pointerId !== activePointerId) return
      activePointerId = null
      pullStartYRef.current = null

      const distance = pullDistanceRef.current
      setPullDistance(0)
      pullDistanceRef.current = 0

      if (distance >= PULL_THRESHOLD && onRefresh && !isRefreshingRef.current) {
        void triggerRefresh()
      }
    }

    async function triggerRefresh() {
      if (!onRefresh || isRefreshingRef.current) return
      isRefreshingRef.current = true
      triggerHapticFeedback('medium')
      await onRefresh()
      isRefreshingRef.current = false
      setRefreshLabel('Updated just now')
    }

    document.addEventListener('pointerdown', handlePointerDown, { passive: true })
    document.addEventListener('pointermove', handlePointerMove, { passive: true })
    document.addEventListener('pointerup', handlePointerEnd, { passive: true })
    document.addEventListener('pointercancel', handlePointerEnd, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerEnd)
      document.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [onRefresh])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInputValue, onSearchChange])

  // ── Sold-out filter toggle — locally managed (not persisted in nav hook)
  const [hideSoldOut, setHideSoldOut] = useState(false)

  // Derive displayProducts: when hideSoldOut is on, filter sold items out.
  // When off, show all products but push sold items to the bottom of the grid.
  const displayProducts = useMemo(() => {
    if (storeScreen === 'likes') return sortedProducts

    if (hideSoldOut) {
      return sortedProducts.filter((p) => p.isAvailable)
    }

    // Keep available items in their sorted order, then append sold items
    const available = sortedProducts.filter((p) => p.isAvailable)
    const sold = sortedProducts.filter((p) => !p.isAvailable)
    return [...available, ...sold]
  }, [sortedProducts, hideSoldOut, storeScreen])

  // ── Hero carousel state ──
  const [activeCampaignIndex, setActiveCampaignIndex] = useState(0)
  const campaignPointerStartRef = useRef<number | null>(null)
  const campaignIsPausedRef = useRef(false)

  const CAMPAIGN_SLIDES = useMemo(() => {
    if (campaigns && campaigns.length > 0) {
      return campaigns.filter((c) => c.isActive).map((c) => ({
        imageUrl: c.imageUrl,
        badgeText: c.tag,
        headline: c.headingPart1,
        subheading: c.headingPart2,
        caption: c.subtitle,
      }))
    }

    return [
      {
        imageUrl: '',
        badgeText: products.filter((p) => p.isAvailable).length > 0 ? 'Live Now' : 'Coming Soon',
        headline: 'DROP 01',
        subheading: 'AVAILABLE NOW',
        caption: 'Limited pieces • First come, first served',
      },
      {
        imageUrl: '',
        badgeText: products.filter((p) => p.isAvailable).length > 0 ? 'New Arrivals' : 'Next Drop',
        headline: 'FRESH',
        subheading: 'NEW ARRIVALS',
        caption: 'Latest pieces added to the collection',
      },
      {
        imageUrl: '',
        badgeText: 'Limited Edition',
        headline: 'EXCLUSIVE',
        subheading: 'ONE-OF-ONE',
        caption: 'Unique pieces you will not find elsewhere',
      },
    ]
  }, [campaigns, products])

  // Auto-advance carousel
  useEffect(() => {
    if (campaignIsPausedRef.current) return

    const timer = setInterval(() => {
      setActiveCampaignIndex((prev) => (prev + 1) % CAMPAIGN_SLIDES.length)
    }, 4000)

    return () => clearInterval(timer)
   
  }, [CAMPAIGN_SLIDES.length])

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

  return (
    <>

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
              <svg className="h-4 w-4 shrink-0 animate-[pull-indicate_0.7s_ease-in-out_infinite] text-[var(--shop-cream)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-cream)]">Release to refresh</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4 shrink-0 text-[var(--shop-muted)] transition-transform" style={{ transform: `rotate(${pullDistance * 2}deg)` }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <svg className="h-3 w-3 shrink-0 text-emerald-100" viewBox="0 0 24 24" fill="currentColor">
          <g transform="translate(4, 4)">

            <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm3.36 4.65a.5.5 0 00-.72-.7l-3.5 3.6-1.35-1.32a.5.5 0 10-.7.7l1.7 1.68a.5.5 0 00.7 0l3.87-3.96z" />
          
          </g>
        </svg>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">{refreshLabel}</span>
        </div>
      </div>

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

        {/* Background image (if available) */}
        {currentCampaign.imageUrl ? (
          <div className="absolute inset-0">
            <img
              src={currentCampaign.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0712] via-[#0f0712]/60 to-transparent" />
          </div>
        ) : null}

        {/* Slide content with crossfade */}
        <div className="relative flex aspect-[16/9] flex-col items-start justify-end p-6 sm:p-8">
          <span
            key={`badge-${activeCampaignIndex}`}
            className="mb-2 animate-[fade-slide-in_0.4s_ease-out_backwards] inline-block rounded-full bg-white/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/70"
          >
            {currentCampaign.badgeText}
          </span>
          <h2
            key={`headline-${activeCampaignIndex}`}
            className="animate-[fade-slide-in_0.4s_ease-out_backwards] text-2xl font-black uppercase leading-none tracking-[-0.04em] text-white sm:text-3xl"
          >
            {currentCampaign.headline}
            <br />
            <span className="text-[var(--shop-purple)]">{currentCampaign.subheading}</span>
          </h2>
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
        <svg viewBox="0 0 24 24" fill="currentColor" className="mr-3 h-4 w-4 shrink-0 text-[var(--shop-muted)]" aria-hidden="true">
          <g transform="translate(2, 2)">

          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
        
          </g>
        </svg>
        <input
          id="catalog-search"
          name="catalog-search"
          value={searchInputValue}
          onChange={(event) => setSearchInputValue(event.target.value)}
          placeholder={storeScreen === 'likes' ? 'Search your likes...' : 'Search items...'}
          className="flex-1 bg-transparent text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60"
        />
        {storeScreen !== 'likes' ? (
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
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
          <g transform="translate(2, 2)">

              <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
            
          </g>
        </svg>
            {hasFilterMenuSelections && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--shop-red)]" />
            )}
          </button>
        ) : null}
      </div>

      {/* ── EXPANDABLE FILTER PANEL (animated reveal) ── */}
      {storeScreen !== 'likes' ? (
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            showFilters ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div
            className={`rounded-2xl border border-white/10 bg-[var(--shop-panel)] p-4 transition-transform duration-300 ease-out ${
              showFilters ? 'translate-y-0' : '-translate-y-2'
            }`}
          >
            {/* Sort — borderless text tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {([['latest', 'Latest'], ['trending', 'Trending']] as const).map(([sortMode, label]) => (
                <button
                  key={sortMode}
                  type="button"
                  onClick={() => {
                    triggerHapticSelection()
                    onSelectSortMode(sortMode)
                  }}
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
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>              {categoryOptions.map((category) => {
              const isActive = selectedCategory === category
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    triggerHapticSelection()
                    onSelectCategory(category)
                  }}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] whitespace-nowrap transition-colors ${
                    isActive ? 'bg-white text-black' : 'bg-white/8 text-[var(--shop-muted)]'
                  }`}
                >
                  {category}
                </button>
              )
            })}
            </div>

            {/* Only Available toggle pill */}
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/6 px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                  Only Available
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hideSoldOut}
                  aria-label="Filter out sold items"
                  onClick={() => {
                    triggerHapticFeedback('light')
                    setHideSoldOut((prev) => !prev)
                  }}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                    hideSoldOut ? 'bg-[var(--shop-purple)]' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                      hideSoldOut ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
          </div>
        </div>
      ) : null}

      {/* ── PRODUCT AREA ── */}
      <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        {/* Results header */}
        {!isLoading && !errorMessage && products.length > 0 ? (
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              {displayProducts.length} {displayProducts.length === 1 ? 'Piece' : 'Pieces'}
            </span>
            {hasActiveFilters && storeScreen !== 'likes' ? (
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

        {/* Loading state - skeleton grid */}
        {isLoading ? (
          <SkeletonProductGrid count={6} />
        ) : null}

        {/* Error state */}
        {!isLoading && errorMessage ? (
          <p className="rounded-2xl bg-[var(--shop-red)]/16 px-4 py-3 text-sm text-[var(--shop-cream)]">{errorMessage}</p>
        ) : null}

        {/* Empty state */}
        {!isLoading && !errorMessage && products.length === 0 ? (
          <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">The drop is empty right now.</p>
        ) : null}

        {/* No matches state — redesigned empty view */}
        {!isLoading && !errorMessage && displayProducts.length === 0 && products.length > 0 ? (
          storeScreen === 'likes' ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white/8 px-6 py-14 text-center">
              <div className="mb-5 flex h-14 w-14 animate-[float_3s_ease-in-out_infinite] items-center justify-center rounded-full border border-white/10 bg-white/6">
                <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 21s-6.7-4.4-9.2-8.1C.8 10 .9 6.5 3.6 4.7c2.2-1.5 5.1-.8 6.8 1.3C12 3.9 14.8 3.2 17 4.7c2.7 1.8 2.8 5.3.8 8.2C18.7 14.2 12 21 12 21Z" />
                </svg>
              </div>
              <p className="animate-[fade-slide-in_0.4s_ease-out_backwards] text-sm font-bold uppercase tracking-[0.18em] text-zinc-300" style={{ animationDelay: '100ms' }}>
                Seems you didn&apos;t like any product yet.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white/8 px-6 py-14 text-center">
              {/* Large muted search icon */}
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/6">
                <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M16.5 16.5L21 21" />
                </svg>
              </div>
              {/* High-contrast title */}
              <p className="animate-[fade-slide-in_0.4s_ease-out_backwards] text-sm font-bold uppercase tracking-[0.2em] text-zinc-300" style={{ animationDelay: '100ms' }}>
                OOPS! NOTHING FOUND
              </p>
              {/* Subtext */}
              <p className="animate-[fade-slide-in_0.4s_ease-out_backwards] mt-2 text-xs leading-relaxed text-zinc-500" style={{ animationDelay: '200ms' }}>
                Try checking your spelling or use different keywords.
              </p>
            </div>
          )
        ) : null}

        {/* Product grid with staggered entrance */}
        {!isLoading && !errorMessage && displayProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {displayProducts.map((product, index) => (
              <div
                key={product.id}
                className={isFirstLoad ? 'animate-[fade-slide-in_0.4s_ease-out_backwards]' : ''}
                style={isFirstLoad ? { animationDelay: `${index * 0.05}s` } : undefined}
              >                  <CatalogProductCard
                    product={product}
                    isLiked={likedProductIdSet.has(product.id)}
                    isSubscribed={isSubscribed(product.id)}
                    onOpenProduct={onOpenProduct}
                    onToggleLike={onToggleLike}
                    onSubscribe={subscribe}
                    onUnsubscribe={unsubscribe}
                    onQuickView={setQuickViewProduct}
                  />
              </div>
            ))}
          </div>
        ) : null}
      </article>
      {/* ── QUICK VIEW BOTTOM SHEET ── */}
      <QuickViewSheet
        isOpen={quickViewProduct !== null}
        product={quickViewProduct}
        isLiked={quickViewProduct ? likedProductIdSet.has(quickViewProduct.id) : false}
        isInCart={quickViewProduct ? cartProductIdSet.has(quickViewProduct.id) : false}
        onClose={() => setQuickViewProduct(null)}
        onToggleLike={onToggleLike}
        onAddToCart={onAddToCart}
        onRemoveFromCart={onRemoveFromCart}
        onOpenDetail={(productId) => {
          onOpenProduct(productId)
        }}
        isSubscribed={quickViewProduct ? isSubscribed(quickViewProduct.id) : false}
        onSubscribe={subscribe}
        onUnsubscribe={unsubscribe}
      />
    </>
  )
}

function getProductHeatScore(product: Product) {
  return product.likesCount + product.cartCount * 2
}

type CatalogProductCardProps = {
  product: Product
  isLiked: boolean
  isSubscribed: boolean
  onOpenProduct: (productId: string) => void
  onToggleLike: (product: Product) => void
  onSubscribe: (productId: string) => Promise<void>
  onUnsubscribe: (productId: string) => Promise<void>
  onQuickView: (product: Product) => void
}

function CatalogProductCard({
  product,
  isLiked,
  isSubscribed: productSubscribed,
  onOpenProduct,
  onToggleLike,
  onSubscribe,
  onUnsubscribe,
  onQuickView,
}: CatalogProductCardProps) {
  const reducedMotion = useReducedMotion()
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const pointerStartXRef = useRef<number | null>(null)
  const didSwipeRef = useRef(false)
  const didLongPressRef = useRef(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  const isSold = !product.isAvailable

  return (
    <article
      role="link"
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-[28px] border bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition-transform ${
        isSold ? 'border-white/6 opacity-50' : 'border-white/10'
      }`}
      onClick={() => {
        if (didSwipeRef.current) {
          didSwipeRef.current = false
          return
        }
        if (didLongPressRef.current) {
          didLongPressRef.current = false
          return
        }
        triggerHapticFeedback('light')
        // Set view-transition-name for shared element transition (skip when reduced motion)
        if (!reducedMotion) {
          const el = document.getElementById(`product-card-img-${product.id}`)
          if (el) {
            el.style.viewTransitionName = `product-img-${product.id}`
          }
        }
        onOpenProduct(product.id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenProduct(product.id)
        }
      }}
      tabIndex={0}
      onContextMenu={(e) => e.preventDefault()}
    >
        <div
          className="relative aspect-square w-full shrink-0 select-none overflow-hidden bg-black/20"
          style={{
            touchAction: 'pan-y',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            activePointerIdRef.current = event.pointerId
            pointerStartXRef.current = event.clientX
            didSwipeRef.current = false
            didLongPressRef.current = false
            // Start long-press timer (~450ms) for quick view
            if (longPressTimerRef.current !== null) {
              clearTimeout(longPressTimerRef.current)
            }
            longPressTimerRef.current = setTimeout(() => {
              longPressTimerRef.current = null
              didLongPressRef.current = true
              triggerHapticFeedback('medium')
              onQuickView(product)
            }, 450)
          }}
          onPointerMove={(event) => {
            if (activePointerIdRef.current !== event.pointerId || pointerStartXRef.current === null) return
            // Cancel long-press on any significant movement
            if (longPressTimerRef.current !== null) {
              clearTimeout(longPressTimerRef.current)
              longPressTimerRef.current = null
            }
            const deltaX = event.clientX - pointerStartXRef.current
            if (Math.abs(deltaX) < 35) return
            didSwipeRef.current = true
            pointerStartXRef.current = event.clientX
            if (deltaX < 0) { moveGallery('next'); return }
            moveGallery('prev')
          }}
          onPointerUp={(event) => {
            // Cancel long-press on pointer up
            if (longPressTimerRef.current !== null) {
              clearTimeout(longPressTimerRef.current)
              longPressTimerRef.current = null
            }
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
            activePointerIdRef.current = null
            pointerStartXRef.current = null
          }}
          onPointerCancel={(event) => {
            // Cancel long-press on cancel
            if (longPressTimerRef.current !== null) {
              clearTimeout(longPressTimerRef.current)
              longPressTimerRef.current = null
            }
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



          {/* Heat badge */}
          {heatScore >= 3 && product.isAvailable ? (
            <span className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--shop-purple)]/90 text-white" aria-label="Trending hot">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
          <g transform="translate(2, 2)">

                <path fillRule="evenodd" d="M13.5 4.938a7 7 0 11-9.006 1.737c.202-.257.59-.218.793.039.278.352.594.672.943.954.332.269.786-.049.773-.476a5.977 5.977 0 01.572-2.759 6.02 6.02 0 012.286-2.624c.248-.162.543-.023.565.222.042.446.164.883.363 1.285.348.702.855 1.29 1.482 1.697.626.407 1.35.63 2.105.635.1.006.225-.006.31-.066a.485.485 0 00.145-.38 6.055 6.055 0 01.422-2.448 6.1 6.1 0 01.932-1.601c.18-.228.525-.13.596.126a6.944 6.944 0 01.466 2.368z" clipRule="evenodd" />
              
          </g>
        </svg>
            </span>
          ) : null}

          {/* Product image */}
          {selectedImage ? (
            <img
              id={`product-card-img-${product.id}`}
              src={selectedImage}
              alt={product.name}
              loading="lazy"
              decoding="async"
              draggable={false}
              className={`h-full w-full select-none object-cover scale-110 transition-all duration-300 ${product.isAvailable ? '' : 'grayscale opacity-60'}`}
              style={{
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">No Image</div>
          )}

          {/* SOLD badge overlay for sold items */}
          {isSold ? (
            <span className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] rounded-xl border-2 border-[var(--shop-muted)]/50 bg-black/70 px-4 py-2 text-sm font-black uppercase tracking-[0.28em] text-[var(--shop-muted)]/80 shadow-[0_0_24px_rgba(0,0,0,0.4)] backdrop-blur-sm">
              SOLD
            </span>
          ) : null}

          {/* Early Access badge */}
          {(() => {
            const accessLevel = product.isAvailable ? getProductAccessLevel(product) : 'private'
            if (accessLevel === 'early_access') {
              return (
                <span className="absolute left-3 top-3 rounded-full bg-amber-500/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                  Early Access
                </span>
              )
            }
            return null
          })()}

          {/* Notify Me button for sold-out / upcoming products */}
          {(!product.isAvailable || product.upcoming) ? (
            <button
              type="button"
              onClick={async (event) => {
                event.stopPropagation()
                triggerHapticFeedback('light')
                if (productSubscribed) {
                  await onUnsubscribe(product.id)
                } else {
                  await onSubscribe(product.id)
                  triggerHapticNotification('success')
                }
              }}
              className={`absolute right-3 bottom-3 z-20 flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90 ${
                productSubscribed
                  ? 'bg-[var(--shop-purple)] text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  : 'bg-black/60 text-white/80 backdrop-blur-sm hover:text-white'
              }`}
              aria-label={productSubscribed ? 'Unsubscribe from notifications' : 'Notify me when available'}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill={productSubscribed ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </button>
          ) : null}
        </div>

        {/* Info section */}
        <div className="flex flex-col px-3 pb-4 pt-3">
          {/* Row 1: Product name (truncated) + Price (same baseline) */}
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={`min-w-0 truncate text-base font-semibold tracking-[-0.03em] ${
                product.isAvailable
                  ? 'text-[var(--shop-cream)]'
                  : 'text-[var(--shop-muted)]/70'
              }`}
              title={product.name}
            >
              {product.name}
            </p>
            <span
              className={`shrink-0 text-sm font-semibold tracking-[-0.03em] ${
                product.isAvailable
                  ? 'text-[var(--shop-cream)]'
                  : 'text-[var(--shop-muted)]/40 line-through'
              }`}
            >
              {product.price} {product.currency}
            </span>
          </div>
          {/* Row 2: Brand (muted, left) + Like button (right) */}
          <div className="mt-1 flex items-center justify-between">
            <p className="truncate text-[10px] uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              {product.brandNames.join(' - ') || product.category}
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                triggerHapticFeedback('light')
                void onToggleLike(product)
              }}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                isLiked
                  ? 'text-[#E61E26]'
                  : 'text-[var(--shop-muted)] hover:text-white/80'
              }`}
              aria-label={isLiked ? 'Unlike' : 'Like'}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s-6.7-4.4-9.2-8.1C.8 10 .9 6.5 3.6 4.7c2.2-1.5 5.1-.8 6.8 1.3C12 3.9 14.8 3.2 17 4.7c2.7 1.8 2.8 5.3.8 8.2C18.7 14.2 12 21 12 21Z" />
              </svg>
            </button>
          </div>
        </div>
    </article>
  )
}