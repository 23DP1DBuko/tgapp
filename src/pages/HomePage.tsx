import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import { AppShell } from '../components/layout/AppShell'
import { AdminStatusPanel } from '../components/admin/AdminStatusPanel'
import { CartPanel } from '../components/cart/CartPanel'
import { StoreCatalogPanel } from '../components/product/StoreCatalogPanel'
import { StoreControlsPanel } from '../components/store/StoreControlsPanel'
import { StoreStickyCartBar } from '../components/store/StoreStickyCartBar'
import { useProducts } from '../hooks/useProducts'
import { getFirebaseApp, hasFirebaseEnv } from '../lib/firebase/config'
import { createOrder } from '../lib/firebase/orders'
import { getPromoCodeByCode, validatePromoCode } from '../lib/firebase/promoCodes'
import {
  updateProductCartCount,
  updateProductLikesCount,
} from '../lib/firebase/products'
import { getFirestoreDb } from '../lib/firebase/firestore'
import {
  canUseBrowserAdminFallback,
  verifyTelegramAdminAccess,
} from '../lib/telegram/admin'
import {
  buildRouteHash,
  readRouteFromHash,
} from '../lib/storeRoute'
import { getTelegramWebAppState } from '../lib/telegram/webApp'
import type {
  CartItem,
  CheckoutForm,
  CheckoutSubmitState,
  CheckoutSuccessSnapshot,
} from '../types/cart'
import type { AppliedPromo } from '../types/promo'
import type { Product, ProductCategory } from '../types/product'

const ProductAdminPanel = lazy(async () => {
  const module = await import('../components/product/ProductAdminPanel')
  return { default: module.ProductAdminPanel }
})

const ProductDetailPanel = lazy(async () => {
  const module = await import('../components/product/ProductDetailPanel')
  return { default: module.ProductDetailPanel }
})

const CheckoutPanel = lazy(async () => {
  const module = await import('../components/cart/CheckoutPanel')
  return { default: module.CheckoutPanel }
})

const PromoAdminPanel = lazy(async () => {
  const module = await import('../components/promo/PromoAdminPanel')
  return { default: module.PromoAdminPanel }
})

const OrderAdminPanel = lazy(async () => {
  const module = await import('../components/order/OrderAdminPanel')
  return { default: module.OrderAdminPanel }
})

const AdminOverviewPanel = lazy(async () => {
  const module = await import('../components/admin/AdminOverviewPanel')
  return { default: module.AdminOverviewPanel }
})

const BuyerOrdersPanel = lazy(async () => {
  const module = await import('../components/order/BuyerOrdersPanel')
  return { default: module.BuyerOrdersPanel }
})
const BroadcastAdminPanel = lazy(async () => {
  const module = await import('../components/broadcast/BroadcastAdminPanel')
  return { default: module.BroadcastAdminPanel }
})

const CART_STORAGE_KEY = 'yungwear-cart-items'
const LIKED_PRODUCTS_STORAGE_KEY = 'yungwear-liked-products'
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
  const { initData, isTelegram, user, theme } = getTelegramWebAppState()
  const firebaseReady = hasFirebaseEnv()
  const firebaseApp = getFirebaseApp()
  const firestoreDb = getFirestoreDb()
  const { products, isLoading, errorMessage, reloadProducts } = useProducts()
  const hasTelegramBuyerAccess = Boolean(isTelegram && initData && user)
  const [activeView, setActiveView] = useState<'store' | 'admin'>(initialRoute.activeView)
  const [storeScreen, setStoreScreen] = useState<
    'catalog' | 'product' | 'likes' | 'orders' | 'cart' | 'checkout' | 'success'
  >(initialStoreScreen)
  const [adminSubView, setAdminSubView] = useState<
    'overview' | 'products' | 'promos' | 'orders' | 'broadcasts'
  >(initialRoute.adminSubView)
  const [storeCollectionView, setStoreCollectionView] = useState<'all' | 'liked'>('all')
  const [storeSortMode, setStoreSortMode] = useState<'latest' | 'trending'>('latest')
  const [storeSearchQuery, setStoreSearchQuery] = useState('')
  const [telegramGateMessage, setTelegramGateMessage] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    initialRoute.selectedProductId,
  )
  const [cartItems, setCartItems] = useState<CartItem[]>(() =>
    readStoredJson<CartItem[]>(CART_STORAGE_KEY, []),
  )
  const [likedProductIds, setLikedProductIds] = useState<string[]>(() =>
    readStoredJson<string[]>(LIKED_PRODUCTS_STORAGE_KEY, []),
  )
  const [checkoutSubmitted, setCheckoutSubmitted] = useState(
    initialStoreScreen === 'success' && Boolean(initialCheckoutSuccessState.snapshot),
  )
  const [checkoutSubmitState, setCheckoutSubmitState] =
    useState<CheckoutSubmitState>('idle')
  const [isAdminAccessLoading, setIsAdminAccessLoading] = useState(
    initialRoute.activeView === 'admin',
  )
  const [canManageProducts, setCanManageProducts] = useState(
    !user ? canUseBrowserAdminFallback() : false,
  )
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(
    initialCheckoutSuccessState.orderId,
  )
  const [checkoutSuccessSnapshot, setCheckoutSuccessSnapshot] =
    useState<CheckoutSuccessSnapshot | null>(initialCheckoutSuccessState.snapshot)
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null)
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  const [isApplyingPromo, setIsApplyingPromo] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    fullName: `${user?.first_name ?? ''}${user?.last_name ? ` ${user.last_name}` : ''}`.trim(),
    telegramHandle: user?.username ? `@${user.username}` : '',
    note: '',
    promoCode: '',
    fulfillmentType: 'meetup',
    paymentMethod: 'meetup_cash',
    deliveryCity: '',
    deliveryAddress: '',
    deliveryNotes: '',
    meetupLocation: '',
    meetupTimeOption: '',
    meetupNotes: '',
  })
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
  const likedProductIdSet = useMemo(() => new Set(likedProductIds), [likedProductIds])
  const telegramUserLabel = useMemo(() => {
    if (user?.username) {
      return `@${user.username}`
    }

    if (user?.first_name) {
      return `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`.trim()
    }

    if (user?.id) {
      return `Telegram user ${user.id}`
    }

    return 'Open in Telegram to connect your account'
  }, [user])
  const telegramContactHint = useMemo(() => {
    if (user?.username) {
      return `Orders will be linked to ${telegramUserLabel} and your Telegram user ID.`
    }

    if (user?.id) {
      return `Orders will be linked to your Telegram user ID ${user.id}, even without a public username.`
    }

    return 'Checkout works only inside the Telegram Mini App.'
  }, [telegramUserLabel, user])
  const validLikedProductIds = useMemo(
    () => likedProductIds.filter((productId) => productIdSet.has(productId)),
    [likedProductIds, productIdSet],
  )
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
  const checkoutSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price, 0),
    [cartItems],
  )
  const checkoutTotal = useMemo(
    () => Math.max(0, checkoutSubtotal - (appliedPromo?.discountAmount ?? 0)),
    [appliedPromo, checkoutSubtotal],
  )
  const unavailableCartProductIds = useMemo(
    () =>
      cartItems
        .filter((item) => !availableProductIdSet.has(item.productId))
        .map((item) => item.productId),
    [availableProductIdSet, cartItems],
  )
  const hasPendingPromoCode = useMemo(() => {
    const normalizedTypedCode = checkoutForm.promoCode.trim().toUpperCase()
    const appliedCode = appliedPromo?.code ?? ''

    if (!normalizedTypedCode) {
      return false
    }

    return normalizedTypedCode !== appliedCode
  }, [appliedPromo, checkoutForm.promoCode])
  const shouldShowStickyCartBar =
    activeView === 'store' &&
    cartItems.length > 0 &&
    (storeScreen === 'catalog' || storeScreen === 'product' || storeScreen === 'likes')

  useEffect(() => {
    writeStoredJson(CART_STORAGE_KEY, cartItems)
  }, [cartItems])

  useEffect(() => {
    writeStoredJson(LIKED_PRODUCTS_STORAGE_KEY, likedProductIds)
  }, [likedProductIds])

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

  useEffect(() => {
    if (products.length === 0) {
      return
    }

    setLikedProductIds((currentIds) =>
      currentIds.filter((productId) => productIdSet.has(productId)),
    )
    setSelectedProductId((currentProductId) =>
      currentProductId && productIdSet.has(currentProductId) ? currentProductId : null,
    )
  }, [productIdSet, products.length])

  useEffect(() => {
    if (unavailableCartProductIds.length === 0) {
      return
    }

    setCartItems((currentItems) =>
      currentItems.filter((item) => !unavailableCartProductIds.includes(item.productId)),
    )
    setCheckoutError(
      'One or more items were removed from your cart because they are no longer available.',
    )

    if (storeScreen === 'checkout') {
      setStoreScreen('cart')
    }
  }, [storeScreen, unavailableCartProductIds])

  useEffect(() => {
    if (hasTelegramBuyerAccess) {
      return
    }

    if (
      storeScreen === 'likes' ||
      storeScreen === 'orders' ||
      storeScreen === 'cart' ||
      storeScreen === 'checkout' ||
      storeScreen === 'success'
    ) {
      setStoreScreen('catalog')
    }
  }, [hasTelegramBuyerAccess, storeScreen])

  function requireTelegramAccess(actionLabel: string) {
    if (hasTelegramBuyerAccess) {
      return true
    }

    setTelegramGateMessage(
      `${actionLabel} is available only inside the Telegram Mini App with a real Telegram session. Open the app in Telegram to continue with real likes, cart, and checkout.`,
    )

    return false
  }

  async function handleAddToCart(product: Product) {
    if (!requireTelegramAccess('Cart actions')) {
      return
    }

    const isAlreadyInCart = cartItems.some((item) => item.productId === product.id)

    if (isAlreadyInCart) {
      return
    }

    setCartItems((currentItems) => {
      if (currentItems.some((item) => item.productId === product.id)) {
        return currentItems
      }

      return [
        ...currentItems,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          currency: product.currency,
          image: product.images[0] ?? null,
        },
      ]
    })

    try {
      await updateProductCartCount(product.id, 1)
    } catch (error) {
      setCartItems((currentItems) =>
        currentItems.filter((item) => item.productId !== product.id),
      )
      setCheckoutError(
        error instanceof Error ? error.message : 'Failed to update cart count.',
      )
    }
  }

  async function handleRemoveFromCart(productId: string) {
    if (!requireTelegramAccess('Cart actions')) {
      return
    }

    const itemToRemove = cartItems.find((item) => item.productId === productId)

    if (!itemToRemove) {
      return
    }

    setCartItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId),
    )

    if (!productIdSet.has(productId)) {
      return
    }

    try {
      await updateProductCartCount(productId, -1)
    } catch (error) {
      setCartItems((currentItems) => [...currentItems, itemToRemove])
      setCheckoutError(
        error instanceof Error ? error.message : 'Failed to update cart count.',
      )
    }
  }

  async function handleToggleLike(product: Product) {
    if (!requireTelegramAccess('Likes')) {
      return
    }

    const isLiked = likedProductIds.includes(product.id)

    setLikedProductIds((currentIds) =>
      isLiked
        ? currentIds.filter((currentId) => currentId !== product.id)
        : [...currentIds, product.id],
    )

    try {
      await updateProductLikesCount(product.id, isLiked ? -1 : 1)
    } catch (error) {
      setLikedProductIds((currentIds) =>
        isLiked
          ? [...currentIds, product.id]
          : currentIds.filter((currentId) => currentId !== product.id),
      )
      setCheckoutError(
        error instanceof Error ? error.message : 'Failed to update likes.',
      )
    }
  }

  function handleOpenCheckout() {
    if (!requireTelegramAccess('Checkout')) {
      return
    }

    setStoreScreen('checkout')
    setCheckoutSubmitted(false)
    setCheckoutSubmitState('idle')
    setCheckoutError(null)
    setCreatedOrderId(null)
    setCheckoutSuccessSnapshot(null)
    setPromoFeedback(null)
  }

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

  function handleCheckoutFieldChange(field: keyof CheckoutForm, value: string) {
    setCheckoutForm((currentForm) => {
      if (field === 'fulfillmentType' && value === 'delivery') {
        return {
          ...currentForm,
          fulfillmentType: 'delivery',
          paymentMethod: 'usdt',
          meetupLocation: '',
          meetupTimeOption: '',
          meetupNotes: '',
        }
      }

      if (field === 'fulfillmentType' && value === 'meetup') {
        return {
          ...currentForm,
          fulfillmentType: 'meetup',
          paymentMethod:
            currentForm.paymentMethod === 'usdt' ? 'usdt' : 'meetup_cash',
          deliveryCity: '',
          deliveryAddress: '',
          deliveryNotes: '',
        }
      }

      return {
        ...currentForm,
        [field]: value,
      }
    })

    if (field === 'promoCode') {
      setAppliedPromo(null)
      setPromoFeedback(null)
    }
  }

  async function handleApplyPromo() {
    const normalizedCode = checkoutForm.promoCode.trim().toUpperCase()

    if (!normalizedCode) {
      setAppliedPromo(null)
      setPromoFeedback('Enter a promo code before applying it.')
      return
    }

    try {
      setIsApplyingPromo(true)
      const promoCode = await getPromoCodeByCode(normalizedCode)

      if (!promoCode) {
        setAppliedPromo(null)
        setPromoFeedback('Promo code not found.')
        return
      }

      const nextAppliedPromo = validatePromoCode(promoCode, checkoutSubtotal)
      setAppliedPromo(nextAppliedPromo)
      setPromoFeedback(`Promo ${nextAppliedPromo.code} applied successfully.`)
      setCheckoutError(null)
    } catch (error) {
      setAppliedPromo(null)
      setPromoFeedback(
        error instanceof Error ? error.message : 'Failed to apply promo code.',
      )
    } finally {
      setIsApplyingPromo(false)
    }
  }

  async function handleSubmitCheckout() {
    if (!requireTelegramAccess('Checkout')) {
      return
    }

    if (checkoutSubmitState === 'submitting') {
      return
    }

    const trimmedName = checkoutForm.fullName.trim()
    const normalizedTelegramHandle = user?.username
      ? `@${user.username}`
      : user?.id
        ? `tg_user_${user.id}`
        : ''

    if (cartItems.length === 0) {
      setCheckoutError('Add at least one product before checkout.')
      return
    }

    if (!trimmedName || !user?.id || !normalizedTelegramHandle) {
      setCheckoutError('Open the Mini App in Telegram with a real account before checkout.')
      return
    }

    if (checkoutForm.fulfillmentType === 'delivery') {
      if (!checkoutForm.deliveryCity.trim() || !checkoutForm.deliveryAddress.trim()) {
        setCheckoutError('Delivery city and address are required.')
        return
      }
    }

    if (checkoutForm.fulfillmentType === 'meetup') {
      if (!checkoutForm.meetupLocation || !checkoutForm.meetupTimeOption) {
        setCheckoutError('Select a meetup location and time option.')
        return
      }
    }

    if (hasPendingPromoCode) {
      setCheckoutError('Apply the promo code first, or clear it before checkout.')
      return
    }

    try {
      setCheckoutSubmitState('submitting')
      const initialStatus =
        checkoutForm.paymentMethod === 'usdt' ? 'waiting_for_payment' : 'new'

      const orderId = await createOrder({
        fullName: trimmedName,
        telegramHandle: normalizedTelegramHandle,
        telegramUserId: user?.id,
        note: checkoutForm.note.trim(),
        fulfillmentType: checkoutForm.fulfillmentType,
        paymentMethod: checkoutForm.paymentMethod,
        deliveryCity: checkoutForm.deliveryCity.trim(),
        deliveryAddress: checkoutForm.deliveryAddress.trim(),
        deliveryNotes: checkoutForm.deliveryNotes.trim(),
        meetupLocation: checkoutForm.meetupLocation,
        meetupTimeOption: checkoutForm.meetupTimeOption,
        meetupNotes: checkoutForm.meetupNotes.trim(),
        items: cartItems,
        subtotal: checkoutSubtotal,
        appliedPromo,
        total: checkoutTotal,
        status: initialStatus,
        cancelReason: '',
      })

      setCheckoutError(null)
      setCreatedOrderId(orderId)
      setCheckoutSuccessSnapshot({
        items: cartItems.map((item) => ({ ...item })),
        form: { ...checkoutForm },
        total: checkoutTotal,
      })
      setCheckoutSubmitted(true)
      setStoreScreen('success')
      setCartItems([])
      setAppliedPromo(null)
      setPromoFeedback(null)
      setCheckoutForm((currentForm) => ({
        ...currentForm,
        note: '',
        promoCode: '',
        fulfillmentType: 'meetup',
        paymentMethod: 'meetup_cash',
        deliveryCity: '',
        deliveryAddress: '',
        deliveryNotes: '',
        meetupLocation: '',
        meetupTimeOption: '',
        meetupNotes: '',
      }))
      await reloadProducts()
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : 'Failed to mark items as sold.',
      )
    } finally {
      setCheckoutSubmitState('idle')
    }
  }

return (
  <AppShell
    title="YUNGWEAR"
    subtitle=""
    isTelegram={isTelegram}
  >
    <section className="space-y-4">

      {/* Store / Admin tab switcher */}
      <article className="rounded-[28px] border border-white/10 bg-white/6 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveView('store')
              setStoreScreen('catalog')
            }}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
              activeView === 'store'
                ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                : 'bg-white/6 text-[var(--shop-muted)]'
            }`}
          >
            <span>Store</span>
            {cartItems.length > 0 && (
              <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/85">
                {cartItems.length} Cart
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView('admin')
              setAdminSubView('overview')
            }}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
              activeView === 'admin'
                ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                : 'bg-white/6 text-[var(--shop-muted)]'
            }`}
          >
            Admin
          </button>
        </div>
      </article>

      {/* Store view */}
      {activeView === 'store' ? (
        <>
          <StoreControlsPanel
            telegramGateMessage={telegramGateMessage}
            telegramBotLink={buildTelegramBotLink()}
            storeScreen={storeScreen}
            likedCount={validLikedProductIds.length}
            cartCount={cartItems.length}
            onCloseGate={() => setTelegramGateMessage(null)}
            onOpenCatalog={handleOpenCatalog}
            onOpenLikes={handleOpenLikes}
            onOpenOrders={handleOpenMyOrders}
            onOpenCart={handleOpenCart}
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
              onToggleLike={handleToggleLike}
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
                  className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
                >
                  Back To {storeCollectionView === 'liked' ? 'Likes' : 'Catalog'}
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
                className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
              >
                Back To Catalog
              </button>
              <CartPanel
                items={cartItems}
                onRemoveItem={handleRemoveFromCart}
                onCheckout={handleOpenCheckout}
                onContinueShopping={handleOpenCatalog}
              />
            </>
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

          {shouldShowStickyCartBar ? (
            <StoreStickyCartBar
              itemCount={cartItems.length}
              total={checkoutTotal}
              onOpenCart={handleOpenCart}
            />
          ) : null}
        </>
      ) : (
        <>
          {/* Admin stats strip */}
          <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[22px] border border-white/10 bg-white/6 px-3 py-4 backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">Products</p>
                <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">{products.length}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/6 px-3 py-4 backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">Sold</p>
                <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
                  {products.filter((p) => !p.isAvailable).length}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/6 px-3 py-4 backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">Mode</p>
                <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">Admin</p>
              </div>
            </div>
          </article>

          <AdminStatusPanel
            isTelegram={isTelegram}
            user={user}
            theme={theme}
            firebaseReady={firebaseReady}
            firebaseInitialized={Boolean(firebaseApp)}
            firestoreReady={Boolean(firestoreDb)}
          />

          {isAdminAccessLoading ? (
            <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">Admin Access</p>
              <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">Verifying Telegram admin access…</p>
            </article>
          ) : canManageProducts ? (
            <>
              <article className="rounded-[28px] border border-white/10 bg-white/6 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['overview', 'Overview'],
                      ['products', 'Products'],
                      ['promos', 'Promos'],
                      ['orders', 'Orders'],
                    ] as const
                  ).map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setAdminSubView(view)}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                        adminSubView === view
                          ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                          : 'bg-white/6 text-[var(--shop-muted)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </article>

              <Suspense fallback={<AdminPanelsLoadingState />}>
                {adminSubView === 'overview' ? (
                  <AdminOverviewPanel
                    productCount={products.length}
                    availableCount={products.filter((p) => p.isAvailable).length}
                    soldCount={products.filter((p) => !p.isAvailable).length}
                    onOpenProducts={() => setAdminSubView('products')}
                    onOpenPromos={() => setAdminSubView('promos')}
                    onOpenOrders={() => setAdminSubView('orders')}
                    onOpenBroadcasts={() => setAdminSubView('broadcasts')}
                  />
                ) : null}
                {adminSubView === 'products' ? (
                  <ProductAdminPanel
                    initData={initData}
                    products={products}
                    onProductsChanged={reloadProducts}
                  />
                ) : null}
                {adminSubView === 'promos' ? (
                  <PromoAdminPanel initData={initData} isEnabled={canManageProducts} />
                ) : null}
                {adminSubView === 'orders' ? (
                  <OrderAdminPanel initData={initData} isEnabled={canManageProducts} />
                ) : null}
                {adminSubView === 'broadcasts' ? (
                  <BroadcastAdminPanel />
                ) : null}
              </Suspense>
            </>
          ) : (
            <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">Admin Access</p>
              <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">
                Admin tools are restricted. Open the Mini App in Telegram with an authorized account.
              </p>
            </article>
          )}
        </>
      )}

    </section>
  </AppShell>
)
}

function AdminPanelsLoadingState() {
  return (
    <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
        Admin Modules
      </p>
      <p className="mt-4 text-sm leading-6 text-[var(--shop-muted)]">
        Loading product, promo, and order management tools...
      </p>
    </article>
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

function readStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  const rawValue = window.localStorage.getItem(key)

  if (!rawValue) {
    return fallback
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

function writeStoredJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

function readStoredSessionJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  const rawValue = window.sessionStorage.getItem(key)

  if (!rawValue) {
    return fallback
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

function writeStoredSessionJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(key, JSON.stringify(value))
}

function removeStoredSessionValue(key: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(key)
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
