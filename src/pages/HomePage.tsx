import { lazy, Suspense, useMemo, useState } from 'react'

import { AppShell } from '../components/layout/AppShell'
import { CartPanel } from '../components/cart/CartPanel'
import { useProducts } from '../hooks/useProducts'
import { getFirebaseApp, hasFirebaseEnv } from '../lib/firebase/config'
import { createOrder } from '../lib/firebase/orders'
import { getPromoCodeByCode, validatePromoCode } from '../lib/firebase/promoCodes'
import { markProductsAsSold } from '../lib/firebase/products'
import { getFirestoreDb } from '../lib/firebase/firestore'
import { canAccessAdminPanel } from '../lib/telegram/admin'
import { getTelegramWebAppState } from '../lib/telegram/webApp'
import type { CartItem, CheckoutForm } from '../types/cart'
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

export function HomePage() {
  const { isTelegram, user, theme } = getTelegramWebAppState()
  const canManageProducts = canAccessAdminPanel(user)
  const firebaseReady = hasFirebaseEnv()
  const firebaseApp = getFirebaseApp()
  const firestoreDb = getFirestoreDb()
  const { products, isLoading, errorMessage, reloadProducts } = useProducts()
  const [activeView, setActiveView] = useState<'store' | 'admin'>('store')
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [checkoutSubmitted, setCheckoutSubmitted] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
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
  const productFields: Array<keyof Product> = [
    'id',
    'name',
    'description',
    'category',
    'brandNames',
    'price',
    'currency',
    'isAvailable',
    'images',
    'createdAt',
    'isLimitedLabel',
  ]
  const categoryOptions = useMemo(() => {
    const categories = new Set<ProductCategory>()

    products.forEach((product) => {
      categories.add(product.category)
    })

    return ['all', ...categories] as Array<'all' | ProductCategory>
  }, [products])
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') {
      return products
    }

    return products.filter((product) => product.category === selectedCategory)
  }, [products, selectedCategory])
  const selectedProduct = useMemo(() => {
    const matchedProduct = selectedProductId
      ? filteredProducts.find((product) => product.id === selectedProductId) ?? null
      : null

    return matchedProduct ?? filteredProducts[0] ?? null
  }, [filteredProducts, selectedProductId])
  const isSelectedProductInCart = useMemo(() => {
    if (!selectedProduct) {
      return false
    }

    return cartItems.some((item) => item.productId === selectedProduct.id)
  }, [cartItems, selectedProduct])
  const checkoutSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price, 0),
    [cartItems],
  )
  const checkoutTotal = useMemo(
    () => Math.max(0, checkoutSubtotal - (appliedPromo?.discountAmount ?? 0)),
    [appliedPromo, checkoutSubtotal],
  )
  const hasPendingPromoCode = useMemo(() => {
    const normalizedTypedCode = checkoutForm.promoCode.trim().toUpperCase()
    const appliedCode = appliedPromo?.code ?? ''

    if (!normalizedTypedCode) {
      return false
    }

    return normalizedTypedCode !== appliedCode
  }, [appliedPromo, checkoutForm.promoCode])

  function handleAddToCart(product: Product) {
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
  }

  function handleRemoveFromCart(productId: string) {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId),
    )
  }

  function handleOpenCheckout() {
    setIsCheckoutOpen(true)
    setCheckoutSubmitted(false)
    setCheckoutError(null)
    setCreatedOrderId(null)
    setPromoFeedback(null)
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
    const trimmedName = checkoutForm.fullName.trim()
    const trimmedHandle = checkoutForm.telegramHandle.trim()
    const productIds = cartItems.map((item) => item.productId)

    if (cartItems.length === 0) {
      setCheckoutError('Add at least one product before checkout.')
      return
    }

    if (!trimmedName || !trimmedHandle) {
      setCheckoutError('Full name and Telegram handle are required.')
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
      const initialStatus =
        checkoutForm.paymentMethod === 'usdt' ? 'waiting_for_payment' : 'new'

      const orderId = await createOrder({
        fullName: trimmedName,
        telegramHandle: trimmedHandle,
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

      await markProductsAsSold(productIds)
      setCheckoutError(null)
      setCreatedOrderId(orderId)
      setCheckoutSubmitted(true)
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
    }
  }

  return (
    <AppShell
      title="Heart Drop"
      subtitle="Purple-box storefront for limited pieces, one-offs, and community-only releases."
      isTelegram={isTelegram}
    >
      <section className="space-y-4">
        <article className="rounded-[28px] border border-white/10 bg-white/6 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveView('store')}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                activeView === 'store'
                  ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                  : 'bg-white/6 text-[var(--shop-muted)]'
              }`}
            >
              Store
            </button>
            <button
              type="button"
              onClick={() => setActiveView('admin')}
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

        <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-3">
            <AdminStat
              label={activeView === 'store' ? 'Visible Pieces' : 'Products'}
              value={String(products.length)}
            />
            <AdminStat
              label={activeView === 'store' ? 'Sold Archive' : 'Sold'}
              value={String(products.filter((product) => !product.isAvailable).length)}
            />
            <AdminStat
              label={activeView === 'store' ? 'Cart' : 'Mode'}
              value={activeView === 'store' ? String(cartItems.length) : 'Admin'}
            />
          </div>
        </article>

        <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-[var(--shop-muted)]">
            Session
          </p>
          <div className="mt-4 space-y-3 text-sm text-[var(--shop-muted)]">
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">Runtime:</span>{' '}
              {isTelegram ? 'Telegram WebApp detected' : 'Running in browser dev mode'}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">User:</span>{' '}
              {user
                ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`
                : 'Telegram user data is not available yet'}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">Username:</span>{' '}
              {user?.username ? `@${user.username}` : 'Not provided'}
            </p>
            <p>
              <span className="font-semibold text-[var(--shop-cream)]">Telegram ID:</span>{' '}
              {user?.id ?? 'Open inside Telegram to see it'}
            </p>
          </div>
        </article>

        {activeView === 'store' ? (
          <>
            <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.28),rgba(255,77,90,0.2))] p-5 text-stone-50 shadow-[0_18px_40px_rgba(24,24,27,0.12)] backdrop-blur-xl">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/70">
                Theme Snapshot
              </p>
              <p className="mt-2 max-w-[16rem] text-sm leading-6 text-[var(--shop-cream)]/85">
                The storefront leans into the purple and red brand palette while still following Telegram surfaces.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <ThemeChip label="bg" value={theme.bg_color} />
                <ThemeChip label="text" value={theme.text_color} />
                <ThemeChip label="button" value={theme.button_color} />
                <ThemeChip label="link" value={theme.link_color} />
              </div>
            </article>

            {!isLoading && !errorMessage && selectedProduct ? (
              <Suspense fallback={<StorePanelLoadingState label="Product Detail" />}>
                <ProductDetailPanel
                  key={selectedProduct.id}
                  product={selectedProduct}
                  isInCart={isSelectedProductInCart}
                  onAddToCart={handleAddToCart}
                />
              </Suspense>
            ) : null}

            <CartPanel
              items={cartItems}
              onRemoveItem={handleRemoveFromCart}
              onCheckout={handleOpenCheckout}
            />

            {isCheckoutOpen ? (
              <Suspense fallback={<StorePanelLoadingState label="Checkout" />}>
                <CheckoutPanel
                  items={cartItems}
                  form={checkoutForm}
                  errorMessage={checkoutError}
                  isSubmitted={checkoutSubmitted}
                  orderId={createdOrderId}
                  promoFeedback={promoFeedback}
                  appliedPromo={appliedPromo}
                  isApplyingPromo={isApplyingPromo}
                  hasPendingPromoCode={hasPendingPromoCode}
                  onChangeForm={handleCheckoutFieldChange}
                  onApplyPromo={handleApplyPromo}
                  onSubmit={handleSubmitCheckout}
                />
              </Suspense>
            ) : null}

            <SectionBanner
              eyebrow="Storefront"
              title="Drop Catalog"
              description="Browse the image-first grid, pick a piece, then open checkout only when the promo state is clean and confirmed."
            />

            <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
                    Catalog
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
                    Image-first drop grid. Tap any piece to open the focused detail view above.
                  </p>
                </div>
                <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-cream)]">
                  2-Column
                </span>
              </div>
              {!isLoading && !errorMessage && products.length > 0 ? (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {categoryOptions.map((category) => {
                      const isActive = selectedCategory === category

                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setSelectedCategory(category)}
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
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                    Showing {filteredProducts.length} of {products.length} products
                  </p>
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

                {!isLoading &&
                  !errorMessage &&
                  filteredProducts.length === 0 && (
                    <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
                      No products match the selected category.
                    </p>
                  )}

                {!isLoading && !errorMessage && filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredProducts.map((product) => {
                      const isSelected = selectedProduct?.id === product.id

                      return (
                        <article
                          key={product.id}
                          className={`overflow-hidden rounded-[28px] border bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition-transform ${
                            isSelected
                              ? 'border-[var(--shop-red)] ring-2 ring-[var(--shop-red)]/30'
                              : 'border-white/10'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedProductId(product.id)}
                            className="w-full text-left"
                          >
                            <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/20">
                              {product.images[0] ? (
                                <img
                                  src={product.images[0]}
                                  alt={product.name}
                                  className={`h-full w-full object-cover transition ${
                                    product.isAvailable ? '' : 'grayscale'
                                  }`}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                                  No Image
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(8,2,10,0.92))] px-3 pb-3 pt-12">
                                <div className="flex items-end justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[var(--shop-cream)]">
                                      {product.name}
                                    </p>
                                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                                      {product.category}
                                    </p>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                                    {product.price} {product.currency}
                                  </span>
                                </div>
                              </div>
                              {product.isLimitedLabel ? (
                                <span className="absolute left-3 top-3 rounded-full bg-[var(--shop-red)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                                  {product.isLimitedLabel}
                                </span>
                              ) : null}
                              {!product.isAvailable ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                                  <span className="rounded-full border border-white/20 bg-black/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white backdrop-blur">
                                    Sold
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </button>
                        </article>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </article>
          </>
        ) : (
          <>
            <SectionBanner
              eyebrow="Admin"
              title="Control Room"
              description="Manage products, promos, and saved checkout requests from one place without leaving the Mini App."
            />

            <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
                Firebase
              </p>
              <div className="mt-4 space-y-3 text-sm text-[var(--shop-muted)]">
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">Status:</span>{' '}
                  {firebaseReady ? 'Environment variables found' : 'Environment variables missing'}
                </p>
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">App:</span>{' '}
                  {firebaseApp ? 'Firebase initialized' : 'Waiting for configuration'}
                </p>
                <p>
                  <span className="font-semibold text-[var(--shop-cream)]">Firestore:</span>{' '}
                  {firestoreDb ? 'Ready for product reads' : 'Waiting for Firebase config'}
                </p>
                <p className="text-[var(--shop-muted)]">
                  Copy <code>.env.example</code> to <code>.env.local</code> and fill in your Firebase project values.
                </p>
              </div>
            </article>

            {canManageProducts ? (
              <Suspense fallback={<AdminPanelsLoadingState />}>
                <ProductAdminPanel products={products} onProductsChanged={reloadProducts} />
                <PromoAdminPanel isEnabled={canManageProducts} />
                <OrderAdminPanel isEnabled={canManageProducts} />
              </Suspense>
            ) : (
              <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
                  Admin Access
                </p>
                <div className="mt-4 space-y-3 text-sm text-[var(--shop-muted)]">
                  <p>Product management is hidden for non-admin users.</p>
                  <p>
                    Add your Telegram numeric user ID to <code>VITE_TELEGRAM_ADMIN_IDS</code> in <code>.env.local</code>.
                  </p>
                  <p>
                    For browser-only local development, you can temporarily set <code>VITE_ENABLE_ADMIN_IN_BROWSER=true</code>.
                  </p>
                </div>
              </article>
            )}

            <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
                Products Foundation
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {productFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-[var(--shop-cream)]"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </article>
          </>
        )}

        <article className="rounded-[32px] border border-dashed border-white/12 bg-white/5 p-5 backdrop-blur-xl">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Next Step
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
            Next we can add promo creation to admin and start showing saved orders in the admin view.
          </p>
        </article>
      </section>
    </AppShell>
  )
}

type ThemeChipProps = {
  label: string
  value?: string
}

function ThemeChip({ label, value }: ThemeChipProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 p-3 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.24em] text-white/60">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <span
          className="h-5 w-5 rounded-full border border-white/15"
          style={{ backgroundColor: value ?? '#ffffff' }}
        />
        <span className="font-medium text-[var(--shop-cream)]">{value ?? 'n/a'}</span>
      </div>
    </div>
  )
}

type SectionBannerProps = {
  eyebrow: string
  title: string
  description: string
}

function SectionBanner({ eyebrow, title, description }: SectionBannerProps) {
  return (
    <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(139,61,255,0.16),rgba(255,77,90,0.12))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/70">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">{description}</p>
    </article>
  )
}

type AdminStatProps = {
  label: string
  value: string
}

function AdminStat({ label, value }: AdminStatProps) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/6 px-3 py-4 backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--shop-cream)]">
        {value}
      </p>
    </div>
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
