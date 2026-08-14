import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useOnlineUsers } from '../hooks/useOnlineUsers'

import { AppShell } from '../components/layout/AppShell'
import { NotificationBanner } from '../components/ui/NotificationBanner'
import { CartPanel } from '../components/cart/CartPanel'
import { StoreCatalogPanel } from '../components/product/StoreCatalogPanel'
import { StoreControlsPanel } from '../components/store/StoreControlsPanel'
import { useCart } from '../hooks/useCart'
import { useCheckout } from '../hooks/useCheckout'
import { useLikes } from '../hooks/useLikes'
import { useProducts } from '../hooks/useProducts'
import { usePromo } from '../hooks/usePromo'
import { useStoreNavigation } from '../hooks/useStoreNavigation'
import { useProductFiltering } from '../hooks/useProductFiltering'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { OfflineBanner } from '../components/ui/OfflineBanner'
import { PageHeader } from '../components/ui/PageHeader'
import {
  readStoredSessionJson,
  writeStoredSessionJson,
  removeStoredSessionValue,
} from '../lib/storage'
import {
  readUserStateJson,
  writeUserStateJson,
  removeUserStateValue,
} from '../lib/userState'
import {
  canUseBrowserAdminFallback,
  verifyTelegramAdminAccess,
} from '../lib/telegram/admin'
import { readRouteFromHash } from '../lib/storeRoute'
import { getTelegramWebAppState, isDevMockEnabled, triggerHapticNotification } from '../lib/telegram/webApp'
import { useTelegramBackButton } from '../hooks/useTelegramBackButton'
import { listCampaigns } from '../lib/firebase/campaigns'
import { subscribeToGiveaways } from '../lib/firebase/giveaways'
import type { Giveaway } from '../types/rewards'
import { fetchAdminAnalytics } from '../lib/firebase/analytics'
import { checkTermsAccepted, withdrawConsent } from '../lib/firebase/consent'
import { ConsentScreen } from '../components/legal/ConsentScreen'
import { PrivacyPolicy } from '../components/legal/PrivacyPolicy'
import { TermsOfService } from '../components/legal/TermsOfService'
import { AboutPage } from '../components/legal/AboutPage'
import { PreferencesPanel } from '../components/settings/PreferencesPanel'
import { useI18n } from '../lib/i18n'
import type { AnalyticsResult } from '../lib/firebase/analytics'
import type { CheckoutSuccessSnapshot } from '../types/cart'
import type { Campaign } from '../types/campaign'

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

// The admin dashboard (and its recharts analytics) is only needed by verified
// admins — lazy-load it so buyers never download the charting library.
const AdminDashboard = lazy(async () => {
  const module = await import('../components/admin/AdminDashboard')
  return { default: module.AdminDashboard }
})

const CHECKOUT_SUCCESS_STORAGE_KEY = 'yungwear-checkout-success'
const CONSENT_STORAGE_KEY = 'yungwear-consent-accepted'

type PersistedCheckoutSuccessState = {
  orderId: string | null
  snapshot: CheckoutSuccessSnapshot | null
}

export function HomePage() {
  const { t } = useI18n()
  const { initData, isTelegram, user } = getTelegramWebAppState()
  const { products, isLoading, errorMessage, reloadProducts } = useProducts()
  const hasTelegramBuyerAccess = Boolean(isTelegram && initData && user)

  // ── Derived sets from products (no hook dependencies) ──

  const productIdSet = useMemo(() => new Set(products.map((p) => p.id)), [products])
  const availableProductIdSet = useMemo(
    () => new Set(products.filter((p) => p.isAvailable).map((p) => p.id)),
    [products],
  )

  // ── Navigation state (self-contained, no cross-hook deps) ──

  const nav = useStoreNavigation(hasTelegramBuyerAccess)

  // Catalog finished loading (without an error) — cart pruning must wait for this
  // or a page reload would wipe the restored cart while products are still loading.
  const productsLoaded = !isLoading && !errorMessage

  // ── Network status (offline detection) ──
  const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus()

  const [notification, setNotification] = useState<string | null>(null)

  // Product ids used as prizes in non-draft giveaways — they stay visible in
  // the catalog but cannot be bought (add-to-cart is hidden and any existing
  // cart items pointing at them are pruned). Derived from the giveaways
  // collection (public read), refreshed on mount alongside campaigns.
  const [giveawayPrizeProductIds, setGiveawayPrizeProductIds] = useState<string[]>([])
  // Products whose giveaway has already been drawn (finished/announced) —
  // shown as "Given Away" instead of the amber "Giveaway Prize" badge.
  const [givenAwayProductIds, setGivenAwayProductIds] = useState<string[]>([])

  // ── Consent state (GDPR) ──
  const [showConsent, setShowConsent] = useState<boolean | null>(null) // null = loading
  // True when the consent status could not be verified (API/network error).
  // The store stays blocked either way (M5: fail closed), this only explains why.
  const [consentCheckFailed, setConsentCheckFailed] = useState(false)

  // Check if user has accepted terms on mount
  useEffect(() => {
    if (!initData) {
      setShowConsent(false)
      return
    }

    // Check local storage first for fast path (per-user key, M3)
    const locallyAccepted = readUserStateJson<boolean>(CONSENT_STORAGE_KEY, false)
    if (locallyAccepted) {
      setShowConsent(false)
      return
    }

    // Dev mock: skip the API call entirely, auto-accept locally
    if (isDevMockEnabled()) {
      writeUserStateJson(CONSENT_STORAGE_KEY, true)
      setShowConsent(false)
      return
    }

    let cancelled = false
    async function checkConsent() {
      try {
        const status = await checkTermsAccepted(initData)
        if (!cancelled) {
          if (status === 'accepted') {
            // Cache locally so we don't check on every load
            writeUserStateJson(CONSENT_STORAGE_KEY, true)
            setShowConsent(false)
          } else {
            // Not accepted — or the status could not be verified. Either way
            // the store stays blocked behind the consent screen (M5: fail
            // closed; never open the store on a failed consent check).
            setConsentCheckFailed(status === 'error')
            setShowConsent(true)
          }
        }
      } catch {
        if (!cancelled) {
          setConsentCheckFailed(true)
          setShowConsent(true)
        }
      }
    }

    void checkConsent()
    return () => { cancelled = true }
  }, [initData])

  const handleConsentAccepted = useCallback(() => {
    writeUserStateJson(CONSENT_STORAGE_KEY, true)
    setConsentCheckFailed(false)
    setShowConsent(false)
    // Always land on the catalog after accepting — never leave the user on the
    // legal page that was shown behind the consent sheet (privacy/terms/about).
    nav.setStoreScreen('catalog')
  }, [nav])

  const handleWithdrawConsent = useCallback(async () => {
    if (!initData) return
    const result = await withdrawConsent(initData)
    if (result.ok) {
      // Clear local cache so consent screen shows again on next load
      removeUserStateValue(CONSENT_STORAGE_KEY)
      setConsentCheckFailed(false)
      triggerHapticNotification('error')
      setShowConsent(true) // Show consent screen again
    }
  }, [initData])

  // ── Viewport state (Telegram keyboard handling) ──
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) return

    const handleViewportChange = (event?: Record<string, unknown>) => {
      const height = typeof event?.height === 'number' ? event.height : window.innerHeight
      // When keyboard opens, viewport shrinks significantly
      setIsKeyboardOpen(height < window.screen.height * 0.8)
    }

    tg.onEvent('viewportChanged', handleViewportChange)
    return () => tg.offEvent('viewportChanged', handleViewportChange)
  }, [])

  // ── Telegram native BackButton ──
  const isBackButtonVisible =
    nav.activeView === 'store' &&
    nav.storeScreen !== 'catalog'

  const handleBackButton = useCallback(() => {
    switch (nav.storeScreen) {
      case 'product':
        nav.handleBackFromProduct()
        break
      case 'cart':
      case 'likes':
      case 'orders':
      case 'rewards':
      case 'preferences':
      case 'privacy':
      case 'terms':
      case 'about':
        nav.handleOpenCatalog()
        break
      case 'success':
      case 'checkout':
        nav.setStoreScreen('cart')
        break
      default:
        break
    }
  }, [nav])

  useTelegramBackButton(isBackButtonVisible, handleBackButton)

  // ── Cart & likes (need requireTelegramAccess + productIdSet) ──

  const giveawayPrizeProductIdSet = useMemo(
    () => new Set(giveawayPrizeProductIds),
    [giveawayPrizeProductIds],
  )
  const givenAwayProductIdSet = useMemo(
    () => new Set(givenAwayProductIds),
    [givenAwayProductIds],
  )

  const {
    cartItems,
    checkoutSubtotal,
    unavailableCartProductIds,
    cartCount,
    handleAddToCart,
    handleRemoveFromCart,
    handleRestoreItem,
    clearCart,
  } = useCart({
    requireTelegramAccess: nav.requireTelegramAccess,
    productIdSet,
    availableProductIdSet,
    giveawayPrizeProductIdSet,
    givenAwayProductIdSet,
    productsLoaded,
    initData,
    onError: setNotification,
  })

  const {
    likedProductIds,
    likedProductIdSet,
    likedCount,
    hasUnreadLikes,
    clearUnreadLikes,
    handleToggleLike,
  } = useLikes({
    requireTelegramAccess: nav.requireTelegramAccess,
    productIdSet,
    initData,
    onError: setNotification,
  })

  // ── Promo (needs checkoutSubtotal + promoCodeRaw) ──

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
    promoCodeRaw: nav.promoCodeRaw,
    initData,
  })

  // ── Checkout initial state detection ──

  const initialRoute = readRouteFromHash()
  const initialCheckoutSuccessState =
    readStoredSessionJson<PersistedCheckoutSuccessState>(
      CHECKOUT_SUCCESS_STORAGE_KEY,
      { orderId: null, snapshot: null },
    )
  const hadPendingCheckoutSuccess =
    initialRoute.storeScreen === 'success' &&
    Boolean(initialCheckoutSuccessState.snapshot)

  // ── Checkout (needs most other state) ──

  const {
    checkoutForm,
    checkoutSubmitted,
    checkoutSubmitState,
    checkoutError,
    fieldErrors,
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
    requireTelegramAccess: nav.requireTelegramAccess,
    cartItems,
    checkoutSubtotal,
    appliedPromo,
    checkoutTotal,
    hasPendingPromoCode,
    clearCart,
    clearPromo,
    reloadProducts,
    onNavigateToCheckout: () => nav.setStoreScreen('checkout'),
    onCheckoutSuccess: () => nav.setStoreScreen('success'),
    onPromoCodeChange: nav.setPromoCodeRaw,
    initialCheckoutSubmitted: hadPendingCheckoutSuccess,
    initialOrderId: initialCheckoutSuccessState.orderId,
    initialSuccessSnapshot: initialCheckoutSuccessState.snapshot,
  })

  // ── Product filtering derived state (needs cart + likes + nav) ──

  const filtering = useProductFiltering({
    products,
    likedProductIdSet,
    likedProductIds,
    storeCollectionView: nav.storeCollectionView,
    storeSearchQuery: nav.storeSearchQuery,
    selectedCategory: nav.selectedCategory,
    storeSortMode: nav.storeSortMode,
    selectedProductId: nav.selectedProductId,
    cartItems,
  })

  // ── Side-effects with cross-hook dependencies ──

  // Destructure stable setters from nav to avoid re-running effects when nav object changes
  const {
    setActiveView: navSetActiveView,
    setStoreScreen: navSetStoreScreen,
    setAdminSubView: navSetAdminSubView,
    setSelectedProductId: navSetSelectedProductId,
    storeScreen: navStoreScreen,
  } = nav

  // Persist checkout success
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

  // Listen for hash changes (forward/back navigation)
  useEffect(() => {
    function handleHashChange() {
      const nextRoute = readRouteFromHash()
      const nextStoreScreen =
        nextRoute.storeScreen === 'success' && !checkoutSuccessSnapshot
          ? 'cart'
          : nextRoute.storeScreen

      navSetActiveView(nextRoute.activeView)
      navSetStoreScreen(nextStoreScreen)
      navSetAdminSubView(nextRoute.adminSubView)
      navSetSelectedProductId(nextRoute.selectedProductId)
      nav.setCheckoutStep(nextRoute.checkoutStep)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [checkoutSuccessSnapshot, navSetActiveView, navSetStoreScreen, navSetAdminSubView, navSetSelectedProductId])

  // Sync selected product when current one is deleted
  useEffect(() => {
    if (filtering.productIdSet.size === 0) return
    navSetSelectedProductId((current) =>
      current && filtering.productIdSet.has(current) ? current : null,
    )
  }, [filtering.productIdSet, navSetSelectedProductId])

  // Redirect restricted screens outside Telegram
  useEffect(() => {
    if (hasTelegramBuyerAccess) return

    if (
      navStoreScreen === 'likes' ||
      navStoreScreen === 'orders' ||
      navStoreScreen === 'cart' ||
      navStoreScreen === 'checkout' ||
      navStoreScreen === 'success' ||
      navStoreScreen === 'rewards'
    ) {
      navSetStoreScreen('catalog')
    }
  }, [hasTelegramBuyerAccess, navStoreScreen, navSetStoreScreen])

  // Redirect away from store screens when consent is revoked
  useEffect(() => {
    if (showConsent !== true) return

    if (
      navStoreScreen !== 'privacy' &&
      navStoreScreen !== 'terms' &&
      navStoreScreen !== 'about'
    ) {
      navSetStoreScreen('privacy')
    }
  }, [showConsent, navStoreScreen, navSetStoreScreen])

  // Legal screens are always accessible (even without Telegram)
  // No redirect needed for privacy/terms/about

  // Navigate back to cart if unavailable items removed during checkout
  useEffect(() => {
    if (unavailableCartProductIds.length > 0 && navStoreScreen === 'checkout') {
      navSetStoreScreen('cart')
    }
  }, [navStoreScreen, unavailableCartProductIds, navSetStoreScreen])

  // ── Modal state tracking for bottom nav auto-hide ──
  const [isModalOpen, setIsModalOpen] = useState(false)

  // ── Admin-only effects ──

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null)
  const [isAdminAccessLoading, setIsAdminAccessLoading] = useState(
    initialRoute.activeView === 'admin',
  )
  const [canManageProducts, setCanManageProducts] = useState(
    !user ? canUseBrowserAdminFallback() : false,
  )
  // Load campaigns for hero carousel
  useEffect(() => {
    let isCancelled = false
    async function loadCampaignSlides() {
      try {
        const data = await listCampaigns(20)
        if (!isCancelled) setCampaigns(data)
      } catch {
        // Silently fall back to hardcoded carousel slides
      }
    }
    void loadCampaignSlides()
    return () => { isCancelled = true }
  }, [])

  // Live-subscribe to giveaways to derive the set of prize product ids
  // (non-draft giveaways only — draft prizes can still be changed by the
  // admin). Scheduled/live giveaways mark the product as an active prize;
  // finished / announced giveaways mark it as given away. A live giveaway
  // wins over a drawn one when the same product appears in both.
  useEffect(() => {
    function applyGiveaways(giveaways: Giveaway[]) {
      const prizeIds = new Set<string>()
      const givenAwayIds = new Set<string>()
      for (const giveaway of giveaways) {
        if (giveaway.status === 'draft') continue
        // Admin toggle: prizes were unlocked for sale (e.g. winner declined)
        // — this giveaway no longer blocks its products in the store.
        if (giveaway.prizesForSale === true) continue
        const drawn = giveaway.status === 'finished' || giveaway.status === 'announced'
        for (const prize of giveaway.prizes) {
          if (!prize.productId) continue
          if (drawn) {
            givenAwayIds.add(prize.productId)
          } else {
            prizeIds.add(prize.productId)
          }
        }
      }
      setGiveawayPrizeProductIds(Array.from(prizeIds))
      // A product that is a prize in a still-running giveaway keeps the
      // active badge — don't let a drawn giveaway downgrade it.
      setGivenAwayProductIds(
        Array.from(givenAwayIds).filter((id) => !prizeIds.has(id)),
      )
    }

    const unsubscribe = subscribeToGiveaways(applyGiveaways, () => {
      // Fail open for display: if giveaways can't be loaded the catalog
      // simply shows no prize badges. Checkout remains the final gate.
    })
    return unsubscribe
  }, [])

  // Fetch analytics when admin view is active
  useEffect(() => {
    if (nav.activeView !== 'admin' || !canManageProducts || !initData) return

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
  }, [nav.activeView, canManageProducts, initData])

  // Resolve admin access
  useEffect(() => {
    let isCancelled = false
    async function resolveAdminAccess() {
      // Dev mock mode: use browser fallback instead of calling verification API
      if (isDevMockEnabled()) {
        if (!isCancelled) {
          setCanManageProducts(true)
          setIsAdminAccessLoading(false)
        }
        return
      }

      if (!user) {
        if (!isCancelled) {
          setCanManageProducts(canUseBrowserAdminFallback())
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

      if (!isCancelled) setIsAdminAccessLoading(true)

      try {
        const result = await verifyTelegramAdminAccess(initData, user)
        if (!isCancelled) {
          setCanManageProducts(result.mode === 'telegram_verified')
        }
      } catch {
        if (!isCancelled) setCanManageProducts(false)
      } finally {
        if (!isCancelled) setIsAdminAccessLoading(false)
      }
    }

    void resolveAdminAccess()
    return () => { isCancelled = true }
  }, [initData, isTelegram, user])

  // Clear checkout error when promo applies
  const prevAppliedPromoRef = useRef(appliedPromo)
  useEffect(() => {
    if (prevAppliedPromoRef.current === null && appliedPromo !== null && checkoutError) {
      setCheckoutError(null)
    }
    prevAppliedPromoRef.current = appliedPromo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedPromo])

  // ── Render ──

  return (      <AppShell
      title="YUNGWEAR"
      showConsent={showConsent}
      bottomNavVisible={
        nav.activeView === 'store' &&
        nav.storeScreen !== 'product' &&
        nav.storeScreen !== 'checkout' &&
        nav.storeScreen !== 'success' &&
        nav.storeScreen !== 'preferences' &&
        nav.storeScreen !== 'privacy' &&
        nav.storeScreen !== 'terms' &&
        nav.storeScreen !== 'about'
      }
      onlineUsersCount={useOnlineUsers(user?.id, initData)}
      isModalOpen={isModalOpen}
      storeScreen={nav.storeScreen}
      likedCount={likedCount}
      cartCount={cartCount}
      onOpenCatalog={nav.handleOpenCatalog}
      onOpenLikes={() => {
        clearUnreadLikes()
        nav.handleOpenLikes()
      }}
      onOpenOrders={nav.handleOpenMyOrders}
      onOpenCart={nav.handleOpenCart}
      onOpenRewards={nav.handleOpenRewards}
      onOpenPrivacy={() => nav.setStoreScreen('privacy')}
      onOpenTerms={() => nav.setStoreScreen('terms')}
      onOpenAbout={() => nav.setStoreScreen('about')}
      onOpenPreferences={nav.handleOpenPreferences}
      onTripleTap={nav.handleTripleTap}
      onWithdrawConsent={handleWithdrawConsent}
      hasUnreadLikes={hasUnreadLikes}
    >
      <section className={`space-y-4 ${isKeyboardOpen ? 'pb-24' : ''}`}>
        {/* GDPR consent screen */}
        {showConsent === true && (
          <ConsentScreen
            initData={initData}
            checkFailed={consentCheckFailed}
            onAccepted={handleConsentAccepted}
            onOpenPrivacy={() => nav.setStoreScreen('privacy')}
            onOpenTerms={() => nav.setStoreScreen('terms')}
          />
        )}

        {/* Offline / reconnected banner */}
        <OfflineBanner
          isOnline={isOnline}
          wasOffline={wasOffline}
          onDismiss={clearWasOffline}
        />

        {notification && (
          <NotificationBanner
            message={notification}
            onClose={() => setNotification(null)}
          />
        )}

        {/* Store view */}
        {nav.activeView === 'store' ? (
          <>
            <StoreControlsPanel
              telegramGateMessage={nav.telegramGateMessage}
              telegramBotLink={buildTelegramBotLink()}
              onCloseGate={() => nav.setTelegramGateMessage(null)}
            />

            {nav.storeScreen === 'catalog' || nav.storeScreen === 'likes' ? (
              <StoreCatalogPanel
                initData={initData}
                storeScreen={nav.storeScreen}
                isLoading={isLoading}
                errorMessage={errorMessage}
                products={products}
                sortedProducts={filtering.sortedProducts}
                giveawayPrizeProductIds={giveawayPrizeProductIds}
                givenAwayProductIds={givenAwayProductIds}
                likedProductIds={likedProductIds}
                categoryOptions={filtering.categoryOptions}
                selectedCategory={nav.selectedCategory}
                storeCollectionView={nav.storeCollectionView}
                storeSortMode={nav.storeSortMode}
                storeSearchQuery={nav.storeSearchQuery}
                onSearchChange={nav.setStoreSearchQuery}
                onSelectCollectionView={nav.handleSelectCollectionView}
                onSelectSortMode={nav.setStoreSortMode}
                onSelectCategory={nav.setSelectedCategory}
                onResetFilters={nav.handleResetCatalogFilters}
                onOpenProduct={nav.handleOpenProduct}
                onRefresh={reloadProducts}
                onToggleLike={handleToggleLike}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                cartItems={cartItems}
                campaigns={campaigns}
                onQuickViewChange={setIsModalOpen}
                onOpenRewards={nav.handleOpenRewards}
              />
            ) : null}

            {nav.storeScreen === 'product' ? (
              filtering.selectedProduct ? (
                <>
                  <PageHeader
                    label={nav.storeCollectionView === 'liked' ? t('home.likes') : t('home.catalog')}
                    onClick={nav.handleBackFromProduct}
                  />
                  <Suspense fallback={<StorePanelLoadingState label={t('loading.productDetail')} />}>
                    <ProductDetailPanel
                      key={filtering.selectedProduct.id}
                      product={filtering.selectedProduct}
                      isInCart={filtering.isSelectedProductInCart}
                      isLiked={filtering.isSelectedProductLiked}
                      isGiveawayPrize={giveawayPrizeProductIdSet.has(filtering.selectedProduct.id)}
                      isGivenAway={givenAwayProductIdSet.has(filtering.selectedProduct.id)}
                      onAddToCart={handleAddToCart}
                      onRemoveFromCart={handleRemoveFromCart}
                      onToggleLike={handleToggleLike}
                      onOpenRewards={nav.handleOpenRewards}
                      initData={initData}
                    />
                  </Suspense>
                </>
              ) : (
                <StoreEmptyState
                  title={t('empty.noProductSelected')}
                  description={t('empty.noProductSelectedDesc')}
                  actionLabel={t('empty.backToCatalog')}
                  onAction={nav.handleOpenCatalog}
                />
              )
            ) : null}

            {nav.storeScreen === 'cart' ? (
              <>
                <PageHeader label={t('home.catalog')} onClick={nav.handleOpenCatalog} />                  <CartPanel
                    items={cartItems}
                    onRemoveItem={handleRemoveFromCart}
                    onRestoreItem={handleRestoreItem}
                    onContinueShopping={nav.handleOpenCatalog}
                    onProceedToCheckout={handleOpenCheckout}
                  />
              </>
            ) : null}

            {nav.storeScreen === 'rewards' ? (
              <Suspense fallback={<StorePanelLoadingState label={t('loading.rewards')} />}>
                <RewardsTasksPanel
                  initData={initData}
                  hasTelegramAccess={hasTelegramBuyerAccess}
                  onBack={nav.handleOpenCatalog}
                  onGiveawayDetailChange={setIsModalOpen}
                />
              </Suspense>
            ) : null}

            {nav.storeScreen === 'privacy' ? (
              <PrivacyPolicy onBack={nav.handleOpenCatalog} />
            ) : null}

            {nav.storeScreen === 'terms' ? (
              <TermsOfService onBack={nav.handleOpenCatalog} />
            ) : null}

            {nav.storeScreen === 'about' ? (
              <AboutPage
                onBack={nav.handleOpenCatalog}
                onOpenPrivacy={() => nav.setStoreScreen('privacy')}
                onOpenTerms={() => nav.setStoreScreen('terms')}
              />
            ) : null}

            {nav.storeScreen === 'preferences' ? (
              <PreferencesPanel
                initData={initData}
                onBack={nav.handleOpenCatalog}
                onError={setNotification}
              />
            ) : null}

            {nav.storeScreen === 'orders' ? (
              <Suspense fallback={<StorePanelLoadingState label={t('loading.myOrders')} />}>
                {user?.id ? (
                  <BuyerOrdersPanel
                    initData={initData}
                    telegramUserId={user.id}
                    onBack={nav.handleOpenCatalog}
                    onOrderModalChange={setIsModalOpen}
                  />
                ) : null}
              </Suspense>
            ) : null}

            {nav.storeScreen === 'checkout' || nav.storeScreen === 'success' ? (
              <>
                {nav.storeScreen === 'checkout' ? (
                  <PageHeader label={t('cart.title')} onClick={nav.handleOpenCart} />
                ) : null}
                <Suspense fallback={<StorePanelLoadingState label={t('loading.checkout')} />}>
                  <CheckoutPanel
                    items={cartItems}
                    form={checkoutForm}
                    fieldErrors={fieldErrors}
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
                    onRemoveItem={handleRemoveFromCart}
                    onViewOrders={nav.handleOpenMyOrders}
                    onBackToCatalog={nav.handleOpenCatalog}
                    onOpenPrivacy={() => nav.setStoreScreen('privacy')}
                    onOpenTerms={() => nav.setStoreScreen('terms')}
                    checkoutStep={nav.checkoutStep}
                    onCheckoutStepChange={nav.setCheckoutStep}
                  />
                </Suspense>
              </>
            ) : null}
          </>
        ) : (
          <Suspense
            fallback={
              <div className="mt-4 rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
                  Admin Access
                </p>
                <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">
                  Loading admin panel&hellip;
                </p>
              </div>
            }
          >
            <AdminDashboard
              products={products}
              analytics={analytics ?? undefined}
              initData={initData}
              isTelegram={isTelegram}
              user={user}
              isAdminAccessLoading={isAdminAccessLoading}
              canManageProducts={canManageProducts}
              adminSubView={nav.adminSubView}
              onSelectSubView={nav.setAdminSubView}
              onProductsChanged={reloadProducts}
            />
          </Suspense>
        )}
      </section>
    </AppShell>
  )
}

// ─── Helper components & functions ───

type StorePanelLoadingStateProps = {
  label: string
}

function StorePanelLoadingState({ label }: StorePanelLoadingStateProps) {
  const { t } = useI18n()
  return (
    <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
        {label}
      </p>
      <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">
        {t('loading.panel')}
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
