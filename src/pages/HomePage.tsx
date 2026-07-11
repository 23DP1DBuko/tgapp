import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { AppShell } from '../components/layout/AppShell'
import { AdminDashboard } from '../components/admin/AdminDashboard'
import { NotificationBanner } from '../components/ui/NotificationBanner'
import { CartPanel } from '../components/cart/CartPanel'
import { StoreCatalogPanel } from '../components/product/StoreCatalogPanel'
import { StoreControlsPanel } from '../components/store/StoreControlsPanel'
import { useCart } from '../hooks/useCart'
import { useCheckout } from '../hooks/useCheckout'
import { useLikes } from '../hooks/useLikes'
import { useProducts } from '../hooks/useProducts'
import { usePromo } from '../hooks/usePromo'
import {
  readStoredSessionJson,
  writeStoredSessionJson,
  removeStoredSessionValue,
} from '../lib/storage'
import {
  canUseBrowserAdminFallback,
  verifyTelegramAdminAccess,
} from '../lib/telegram/admin'
import {
  buildRouteHash,
  readRouteFromHash,
} from '../lib/storeRoute'
import { getTelegramWebAppState } from '../lib/telegram/webApp'
import {
  listBannerSlides,
} from '../lib/firebase/bannerSlides'
import { fetchAdminAnalytics } from '../lib/firebase/analytics'
import type {
  AnalyticsResult,
} from '../lib/firebase/analytics'
import type {
  CheckoutSuccessSnapshot,
} from '../types/cart'
import type { BannerSlide } from '../types/bannerSlide'
import type { Product, ProductCategory } from '../types/product'

const ProductDetailPanel = lazy(async () => {
  const module = await import('../components/product/ProductDetailPanel')
  return { default: module.ProductDetailPanel }
})

const CheckoutPanel = lazy(async () => {
  const module = await import('../components/cart/CheckoutPanel')
  return { default: module.CheckoutPanel }
})

const BuyerOrdersPanel = lazy(async () => {
  const module = await import('../components/order/BuyerOrdersPanel')
  return { default: module.BuyerOrdersPanel }
})

const RewardsTasksPanel = lazy(async () => {
  const module = await import('../components/rewards/RewardsTasksPanel')
  return { default: module.RewardsTasksPanel }
})
const CHECKOUT_SUCCESS_STORAGE_KEY = 'yungwear-checkout-success'

type PersistedCheckoutSuccessState = {
  orderId: string | null
  snapshot: CheckoutSuccessSnapshot | null
}

export function HomePage() {
  const initialRoute = readRouteFromHash()
  const initialCheckoutSuccessState = readStoredSessionJson<PersistedCheckoutSuccessState>(
    CHECKOUT_SUCCESS_STORAGE_KEY,
    {
      orderId: null,
      snapshot: null,
    },
  )
  const initialStoreScreen =
    initialRoute.storeScreen === 'success'
      ? initialCheckoutSuccessState.snapshot
        ? 'success'
        : 'cart'
      : initialRoute.storeScreen
  const { initData, isTelegram, user } = getTelegramWebAppState()
  const { products, isLoading, errorMessage, reloadProducts } = useProducts()
  const hasTelegramBuyerAccess = Boolean(isTelegram && initData && user)
  const [activeView, setActiveView] = useState<'store' | 'admin'>(initialRoute.activeView)
  const [storeScreen, setStoreScreen] = useState<
    'catalog' | 'product' | 'likes' | 'orders' | 'cart' | 'checkout' | 'success' | 'rewards'
  >(initialStoreScreen)
  const [adminSubView, setAdminSubView] = useState<
    | 'overview'
    | 'products'
    | 'promos'
    | 'orders'
    | 'broadcasts'
    | 'campaigns'
    | 'rewards'
    | 'dashboard'
  >(initialRoute.adminSubView)
  const [storeCollectionView, setStoreCollectionView] = useState<'all' | 'liked'>('all')
  const [storeSortMode, setStoreSortMode] = useState<'latest' | 'trending'>('latest')
  const [storeSearchQuery, setStoreSearchQuery] = useState('')
  const [telegramGateMessage, setTelegramGateMessage] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    initialRoute.selectedProductId,
  )
  const [isAdminAccessLoading, setIsAdminAccessLoading] = useState(
    initialRoute.activeView === 'admin',
  )
  const [canManageProducts, setCanManageProducts] = useState(
    !user ? canUseBrowserAdminFallback() : false,
  )
  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [promoCodeRaw, setPromoCodeRaw] = useState('')

  const categoryOptions = useMemo(() => {
    const categories = new Set<ProductCategory>()

    products.forEach((product) => {
      categories.add(product.category)
    })

    return ['all', ...categories] as Array<'all' | ProductCategory>
  }, [products])
  const productIdSet = useMemo(() => new Set(products.map((product) => product.id)), [products])
  const availableProductIdSet = useMemo(
    () => new Set(products.filter((product) => product.isAvailable).map((product) => product.id)),
    [products],
  )

  // --- Hooks ---

  function requireTelegramAccess(actionLabel: string) {
    if (hasTelegramBuyerAccess) {
      return true
    }

    setTelegramGateMessage(
      `${actionLabel} is available only inside the Telegram Mini App with a real Telegram session. Open the app in Telegram to continue with real likes, cart, and checkout.`,
    )

    return false
  }

  const {
    cartItems,
    checkoutSubtotal,
    unavailableCartProductIds,
    cartCount,
    handleAddToCart,
    handleRemoveFromCart,
    clearCart,
  } = useCart({
    requireTelegramAccess,
    productIdSet,
    availableProductIdSet,
    onError: setNotification,
  })

  const {
    likedProductIds,
    likedProductIdSet,
    validLikedProductIds,
    likedCount,
    handleToggleLike,
  } = useLikes({
    requireTelegramAccess,
    productIdSet,
    onError: setNotification,
  })

  const {
    appliedPromo,
    promoFeedback,
    isApplyingPromo,
    checkoutTotal,
    hasPendingPromoCode,
    handleApplyPromo,
    clearPromo,
  } = usePromo({
    checkoutSubtotal,
    promoCodeRaw,
  })

  const {
    checkoutForm,
    checkoutSubmitted,
    checkoutSubmitState,
    checkoutError,
    createdOrderId,
    checkoutSuccessSnapshot,
    telegramUserLabel,
    telegramContactHint,
    handleCheckoutFieldChange,
    handleSubmitCheckout,
    handleOpenCheckout,
    setCheckoutError,
  } = useCheckout({
    user,
    initData,
    requireTelegramAccess,
    cartItems,
    checkoutSubtotal,
    appliedPromo,
    checkoutTotal,
    hasPendingPromoCode,
    clearCart,
    clearPromo,
    reloadProducts,
    onNavigateToCheckout: () => setStoreScreen('checkout'),
    onCheckoutSuccess: () => setStoreScreen('success'),
    onPromoCodeChange: setPromoCodeRaw,
    initialCheckoutSubmitted: initialStoreScreen === 'success' && Boolean(initialCheckoutSuccessState.snapshot),
    initialOrderId: initialCheckoutSuccessState.orderId,
    initialSuccessSnapshot: initialCheckoutSuccessState.snapshot,
  })

  // --- Derived state ---

  const filteredProducts = useMemo(() => {
    const normalizedQuery = storeSearchQuery.trim().toLowerCase()
    const nextProducts =
      storeCollectionView === 'liked'
        ? products.filter((product) => likedProductIdSet.has(product.id))
        : products

    const categoryFilteredProducts =
      selectedCategory === 'all'
        ? nextProducts
        : nextProducts.filter((product) => product.category === selectedCategory)

    if (!normalizedQuery) {
      return categoryFilteredProducts
    }

    return categoryFilteredProducts.filter((product) => {
      const searchBody = [
        product.name,
        product.category,
        ...product.brandNames,
      ]
        .join(' ')
        .toLowerCase()

      return searchBody.includes(normalizedQuery)
    })
  }, [likedProductIdSet, products, selectedCategory, storeCollectionView, storeSearchQuery])
  const sortedProducts = useMemo(() => {
    const nextProducts = [...filteredProducts]

    nextProducts.sort((leftProduct, rightProduct) => {
      if (storeSortMode === 'trending') {
        const scoreDifference =
          getProductHeatScore(rightProduct) - getProductHeatScore(leftProduct)

        if (scoreDifference !== 0) {
          return scoreDifference
        }
      }

      const leftTime = leftProduct.createdAt?.toMillis() ?? 0
      const rightTime = rightProduct.createdAt?.toMillis() ?? 0

      return rightTime - leftTime
    })

    return nextProducts
  }, [filteredProducts, storeSortMode])
  const selectedProduct = useMemo(() => {
    const matchedProduct = selectedProductId
      ? sortedProducts.find((product) => product.id === selectedProductId) ?? null
      : null

    return matchedProduct ?? sortedProducts[0] ?? null
  }, [selectedProductId, sortedProducts])
  const isSelectedProductInCart = useMemo(() => {
    if (!selectedProduct) {
      return false
    }

    return cartItems.some((item) => item.productId === selectedProduct.id)
  }, [cartItems, selectedProduct])
  const isSelectedProductLiked = useMemo(() => {
    if (!selectedProduct) {
      return false
    }

    return likedProductIds.includes(selectedProduct.id)
  }, [likedProductIds, selectedProduct])
  // Load banner slides for the hero carousel
  useEffect(() => {
    let isCancelled = false

    async function loadBannerSlides() {
      try {
        const slides = await listBannerSlides(20)
        if (!isCancelled) {
          setBannerSlides(slides)
        }
      } catch {
        // Silently fall back to hardcoded carousel slides
      }
    }

    void loadBannerSlides()

    return () => {
      isCancelled = true
    }
  }, [])

  // Fetch analytics when admin view is active
  useEffect(() => {
    if (activeView !== 'admin' || !canManageProducts || !initData) {
      return
    }

    let isCancelled = false

    async function loadAnalytics() {
      try {
        const data = await fetchAdminAnalytics(initData)
        if (!isCancelled) setAnalytics(data)
      } catch {
        // Fall back to local defaults
      }
    }

    void loadAnalytics()

    return () => { isCancelled = true }
  }, [activeView, canManageProducts, initData])

  // --- Effects ---

  useEffect(() => {
    if (!checkoutSuccessSnapshot) {
      removeStoredSessionValue(CHECKOUT_SUCCESS_STORAGE_KEY)
      return
    }

    writeStoredSessionJson(CHECKOUT_SUCCESS_STORAGE_KEY, {
      orderId: createdOrderId,
      snapshot: checkoutSuccessSnapshot,
    })
  }, [checkoutSuccessSnapshot, createdOrderId])

  useEffect(() => {
    let isCancelled = false

    async function resolveAdminAccess() {
      if (!user) {
        const browserFallbackEnabled = canUseBrowserAdminFallback()

        if (!isCancelled) {
          setCanManageProducts(browserFallbackEnabled)
          setIsAdminAccessLoading(false)
        }

        return
      }

      if (!isTelegram || !initData) {
        if (!isCancelled) {
          setCanManageProducts(false)
          setIsAdminAccessLoading(false)
        }

        return
      }

      if (!isCancelled) {
        setIsAdminAccessLoading(true)
      }

      try {
        const verificationResult = await verifyTelegramAdminAccess(initData, user)

        if (!isCancelled) {
          setCanManageProducts(verificationResult.mode === 'telegram_verified')
        }
      } catch {
        if (!isCancelled) {
          setCanManageProducts(false)
        }
      } finally {
        if (!isCancelled) {
          setIsAdminAccessLoading(false)
        }
      }
    }

    void resolveAdminAccess()

    return () => {
      isCancelled = true
    }
  }, [initData, isTelegram, user])

  useEffect(() => {
    function handleHashChange() {
      const nextRoute = readRouteFromHash()
      const nextStoreScreen =
        nextRoute.storeScreen === 'success' && !checkoutSuccessSnapshot
          ? 'cart'
          : nextRoute.storeScreen

      setActiveView(nextRoute.activeView)
      setStoreScreen(nextStoreScreen)
      setAdminSubView(nextRoute.adminSubView)
      setSelectedProductId(nextRoute.selectedProductId)
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [checkoutSuccessSnapshot])

  useEffect(() => {
    const nextHash = buildRouteHash({
      activeView,
      storeScreen,
      adminSubView,
      selectedProductId,
    })

    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash
    }
  }, [activeView, adminSubView, selectedProductId, storeScreen])

  // Sync selected product if the current one was deleted
  useEffect(() => {
    if (productIdSet.size === 0) {
      return
    }

    setSelectedProductId((currentProductId) =>
      currentProductId && productIdSet.has(currentProductId) ? currentProductId : null,
    )
  }, [productIdSet])

  // Navigate back to cart if unavailable items were removed during checkout
  useEffect(() => {
    if (unavailableCartProductIds.length > 0 && storeScreen === 'checkout') {
      setStoreScreen('cart')
    }
  }, [storeScreen, unavailableCartProductIds])

  // Clear checkout error only when a promo transitions from not-applied to applied
  const prevAppliedPromoRef = useRef(appliedPromo)

  useEffect(() => {
    if (prevAppliedPromoRef.current === null && appliedPromo !== null && checkoutError) {
      setCheckoutError(null)
    }

    prevAppliedPromoRef.current = appliedPromo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedPromo])

  // Redirect restricted screens to catalog when accessed outside Telegram
  useEffect(() => {
    if (hasTelegramBuyerAccess) {
      return
    }

    if (
      storeScreen === 'likes' ||
      storeScreen === 'orders' ||
      storeScreen === 'cart' ||
      storeScreen === 'checkout' ||
      storeScreen === 'success' ||
      storeScreen === 'rewards'
    ) {
      setStoreScreen('catalog')
    }
  }, [hasTelegramBuyerAccess, storeScreen])

  // Smooth-scroll to top when navigating to the catalog, likes, or rewards view
  useEffect(() => {
    if (storeScreen === 'catalog' || storeScreen === 'likes' || storeScreen === 'rewards') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [storeScreen])

  // --- Event handlers ---

  function handleOpenCatalog() {
    setStoreScreen('catalog')
    setStoreCollectionView('all')
  }

  function handleResetCatalogFilters() {
    setStoreSearchQuery('')
    setSelectedCategory('all')
    setStoreCollectionView('all')
    setStoreSortMode('latest')
    setStoreScreen('catalog')
  }

  function handleOpenMyOrders() {
    if (!requireTelegramAccess('Order history')) {
      return
    }

    setStoreScreen('orders')
  }

  function handleOpenLikes() {
    if (!requireTelegramAccess('Saved likes')) {
      return
    }

    setStoreCollectionView('liked')
    setStoreScreen('likes')
  }

  function handleOpenProduct(productId: string) {
    setSelectedProductId(productId)
    setStoreScreen('product')
  }

  function handleOpenCart() {
    if (!requireTelegramAccess('Cart')) {
      return
    }

    setStoreScreen('cart')
  }

  function handleOpenRewards() {
    if (!requireTelegramAccess('Rewards')) {
      return
    }

    setStoreScreen('rewards')
  }

return (
  <AppShell
    title="YUNGWEAR"
    bottomNavVisible={activeView === 'store' && storeScreen !== 'checkout' && storeScreen !== 'success'}
    storeScreen={storeScreen}
    likedCount={likedCount}
    cartCount={cartCount}
    onOpenCatalog={handleOpenCatalog}
    onOpenLikes={handleOpenLikes}
    onOpenOrders={handleOpenMyOrders}
    onOpenCart={handleOpenCart}
    onOpenRewards={handleOpenRewards}
    onTripleTap={() => {
      if (activeView === 'admin') {
        setActiveView('store')
        setStoreScreen('catalog')
      } else {
        setActiveView('admin')
        setAdminSubView('overview')
      }
    }}
  >
    <section className="space-y-4">

      {notification && (
        <NotificationBanner
          message={notification}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Store view */}
      {activeView === 'store' ? (
        <>
          <StoreControlsPanel
            telegramGateMessage={telegramGateMessage}
            telegramBotLink={buildTelegramBotLink()}
            onCloseGate={() => setTelegramGateMessage(null)}
          />

          {(storeScreen === 'catalog' || storeScreen === 'likes') ? (
            <StoreCatalogPanel
              storeScreen={storeScreen}
              isLoading={isLoading}
              errorMessage={errorMessage}
              products={products}
              sortedProducts={sortedProducts}
              selectedProductId={selectedProduct?.id ?? null}
              validLikedProductIds={validLikedProductIds}
              likedProductIds={likedProductIds}
              categoryOptions={categoryOptions}
              selectedCategory={selectedCategory}
              storeCollectionView={storeCollectionView}
              storeSortMode={storeSortMode}
              storeSearchQuery={storeSearchQuery}
              onSearchChange={setStoreSearchQuery}
              onSelectCollectionView={(view) => {
                setStoreCollectionView(view)
                setStoreScreen(view === 'liked' ? 'likes' : 'catalog')
              }}
              onSelectSortMode={setStoreSortMode}
              onSelectCategory={setSelectedCategory}
              onResetFilters={handleResetCatalogFilters}
              onOpenLikes={handleOpenLikes}
              onOpenProduct={handleOpenProduct}
              onOpenLikedProduct={(productId) => {
                setStoreCollectionView('liked')
                handleOpenProduct(productId)
              }}
              onRefresh={reloadProducts}
              onToggleLike={handleToggleLike}
              bannerSlides={bannerSlides}
            />
          ) : null}

          {storeScreen === 'product' ? (
            selectedProduct ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setStoreScreen(storeCollectionView === 'liked' ? 'likes' : 'catalog')
                  }
                  className="rounded-[24px] border border-white/10 bg-white/6 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
                >
                  ← {storeCollectionView === 'liked' ? 'Likes' : 'Catalog'}
                </button>
                <Suspense fallback={<StorePanelLoadingState label="Product Detail" />}>
                  <ProductDetailPanel
                    key={selectedProduct.id}
                    product={selectedProduct}
                    isInCart={isSelectedProductInCart}
                    isLiked={isSelectedProductLiked}
                    onAddToCart={handleAddToCart}
                    onToggleLike={handleToggleLike}
                  />
                </Suspense>
              </>
            ) : (
              <StoreEmptyState
                title="No Product Selected"
                description="Go back to the catalog and pick a piece."
                actionLabel="Back To Catalog"
                onAction={handleOpenCatalog}
              />
            )
          ) : null}

          {storeScreen === 'cart' ? (
            <>
              <button
                type="button"
                onClick={handleOpenCatalog}
                className="rounded-[24px] border border-white/10 bg-white/6 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
              >
                ← Catalog
              </button>
              <CartPanel
                items={cartItems}
                onRemoveItem={handleRemoveFromCart}
                onCheckout={handleOpenCheckout}
                onContinueShopping={handleOpenCatalog}
              />
            </>
          ) : null}

          {storeScreen === 'rewards' ? (
            <Suspense fallback={<StorePanelLoadingState label="Rewards" />}>
              <RewardsTasksPanel
                initData={initData}
                hasTelegramAccess={hasTelegramBuyerAccess}
                onBack={handleOpenCatalog}
              />
            </Suspense>
          ) : null}

          {storeScreen === 'orders' ? (
            <Suspense fallback={<StorePanelLoadingState label="My Orders" />}>
              {user?.id ? (
                <BuyerOrdersPanel
                  initData={initData}
                  telegramUserId={user.id}
                  onBack={handleOpenCatalog}
                />
              ) : null}
            </Suspense>
          ) : null}

          {storeScreen === 'checkout' || storeScreen === 'success' ? (
            <>
              {storeScreen === 'checkout' ? (
                <button
                  type="button"
                  onClick={handleOpenCart}
                  className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
                >
                  Back To Cart
                </button>
              ) : null}
              <Suspense fallback={<StorePanelLoadingState label="Checkout" />}>
                <CheckoutPanel
                  items={cartItems}
                  form={checkoutForm}
                  telegramUserLabel={telegramUserLabel}
                  telegramContactHint={telegramContactHint}
                  errorMessage={checkoutError}
                  isSubmitted={checkoutSubmitted}
                  orderId={createdOrderId}
                  successSnapshot={checkoutSuccessSnapshot}
                  promoFeedback={promoFeedback}
                  appliedPromo={appliedPromo}
                  isApplyingPromo={isApplyingPromo}
                  submitState={checkoutSubmitState}
                  hasPendingPromoCode={hasPendingPromoCode}
                  onChangeForm={handleCheckoutFieldChange}
                  onApplyPromo={handleApplyPromo}
                  onSubmit={handleSubmitCheckout}
                  onViewOrders={handleOpenMyOrders}
                  onBackToCatalog={handleOpenCatalog}
                />
              </Suspense>
            </>
          ) : null}

        </>
      ) : (
        <AdminDashboard
          products={products}
          analytics={analytics ?? undefined}
          initData={initData}
          isTelegram={isTelegram}
          user={user}
          isAdminAccessLoading={isAdminAccessLoading}
          canManageProducts={canManageProducts}
          adminSubView={adminSubView}
          onSelectSubView={setAdminSubView}
          onProductsChanged={reloadProducts}
        />
      )}

    </section>
  </AppShell>
)
}

type StorePanelLoadingStateProps = {
  label: string
}

function StorePanelLoadingState({ label }: StorePanelLoadingStateProps) {
  return (
    <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
        {label}
      </p>
      <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">
        Loading this panel...
      </p>
    </article>
  )
}

type StoreEmptyStateProps = {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

function StoreEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: StoreEmptyStateProps) {
  return (
    <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
        {title}
      </p>
      <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 rounded-[24px] bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white"
      >
        {actionLabel}
      </button>
    </article>
  )
}

function getProductHeatScore(product: Product) {
  return product.likesCount + product.cartCount * 2
}

function buildTelegramBotLink() {
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.trim()
  const startApp = import.meta.env.VITE_TELEGRAM_BOT_STARTAPP?.trim()
  const start = import.meta.env.VITE_TELEGRAM_BOT_START?.trim()

  if (botUsername) {
    const normalizedBotUsername = botUsername.replace(/^@/, '')

    if (startApp) {
      return `https://t.me/${normalizedBotUsername}?startapp=${encodeURIComponent(startApp)}`
    }

    if (start) {
      return `https://t.me/${normalizedBotUsername}?start=${encodeURIComponent(start)}`
    }

    return `https://t.me/${normalizedBotUsername}`
  }

  return 'https://telegram.org/'
}
