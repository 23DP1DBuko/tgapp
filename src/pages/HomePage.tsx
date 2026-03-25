import { useMemo, useState } from 'react'

import { AppShell } from '../components/layout/AppShell'
import { ProductAdminPanel } from '../components/product/ProductAdminPanel'
import { ProductDetailPanel } from '../components/product/ProductDetailPanel'
import { useProducts } from '../hooks/useProducts'
import { getFirebaseApp, hasFirebaseEnv } from '../lib/firebase/config'
import { getFirestoreDb } from '../lib/firebase/firestore'
import { canAccessAdminPanel } from '../lib/telegram/admin'
import { getTelegramWebAppState } from '../lib/telegram/webApp'
import type { Product, ProductCategory } from '../types/product'

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

  return (
    <AppShell
      title="Drop Preview"
      subtitle="Mobile-first storefront with a simple admin flow for Telegram Mini App development."
      isTelegram={isTelegram}
    >
      <section className="space-y-4">
        <article className="rounded-[28px] border border-black/10 bg-white p-3 shadow-[0_18px_40px_rgba(24,24,27,0.06)]">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveView('store')}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                activeView === 'store'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              Store
            </button>
            <button
              type="button"
              onClick={() => setActiveView('admin')}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                activeView === 'admin'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              Admin
            </button>
          </div>
        </article>

        <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_40px_rgba(24,24,27,0.06)]">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">
            Session
          </p>
          <div className="mt-4 space-y-3 text-sm text-zinc-700">
            <p>
              <span className="font-semibold text-zinc-900">Runtime:</span>{' '}
              {isTelegram ? 'Telegram WebApp detected' : 'Running in browser dev mode'}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">User:</span>{' '}
              {user
                ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`
                : 'Telegram user data is not available yet'}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Username:</span>{' '}
              {user?.username ? `@${user.username}` : 'Not provided'}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Telegram ID:</span>{' '}
              {user?.id ?? 'Open inside Telegram to see it'}
            </p>
          </div>
        </article>

        {activeView === 'store' ? (
          <>
            <article className="rounded-[28px] border border-black/10 bg-stone-900 p-5 text-stone-50 shadow-[0_18px_40px_rgba(24,24,27,0.12)]">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-400">
                Telegram Theme Snapshot
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <ThemeChip label="bg" value={theme.bg_color} />
                <ThemeChip label="text" value={theme.text_color} />
                <ThemeChip label="button" value={theme.button_color} />
                <ThemeChip label="link" value={theme.link_color} />
              </div>
            </article>

            {!isLoading && !errorMessage && selectedProduct ? (
              <ProductDetailPanel key={selectedProduct.id} product={selectedProduct} />
            ) : null}

            <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_40px_rgba(24,24,27,0.06)]">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">
                Product List
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">
                This reads from the Firestore <code>products</code> collection using the shared product type and the schema defined in <code>FIREBASE_SCHEMA.md</code>.
              </p>
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
                              ? 'bg-zinc-900 text-white'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {category}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-stone-500">
                    Showing {filteredProducts.length} of {products.length} products
                  </p>
                </div>
              ) : null}
              <div className="mt-4 space-y-3">
                {isLoading ? (
                  <p className="rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
                    Loading products...
                  </p>
                ) : null}

                {!isLoading && errorMessage ? (
                  <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {errorMessage}
                  </p>
                ) : null}

                {!isLoading && !errorMessage && products.length === 0 ? (
                  <p className="rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
                    No products found yet. Add a document to the <code>products</code> collection to see it here.
                  </p>
                ) : null}

                {!isLoading &&
                  !errorMessage &&
                  filteredProducts.length === 0 && (
                    <p className="rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
                      No products match the selected category.
                    </p>
                  )}

                {!isLoading &&
                  !errorMessage &&
                  filteredProducts.map((product) => (
                    <article
                      key={product.id}
                      className="rounded-[24px] border border-black/10 bg-stone-50 p-4"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedProductId(product.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start gap-4">
                          <div className="h-28 w-24 shrink-0 overflow-hidden rounded-[20px] bg-stone-200">
                            {product.images[0] ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                                No Image
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-base font-semibold text-zinc-900">{product.name}</h3>
                                <p className="mt-1 text-sm text-zinc-600">{product.description}</p>
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

                            <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-600">
                              <span className="rounded-full bg-white px-3 py-1">
                                {product.price} {product.currency}
                              </span>
                              <span className="rounded-full bg-white px-3 py-1">{product.category}</span>
                              {product.brandNames.map((brand) => (
                                <span key={brand} className="rounded-full bg-white px-3 py-1">
                                  {brand}
                                </span>
                              ))}
                              {product.isLimitedLabel ? (
                                <span className="rounded-full bg-black px-3 py-1 text-white">
                                  {product.isLimitedLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    </article>
                  ))}
              </div>
            </article>
          </>
        ) : (
          <>
            <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_40px_rgba(24,24,27,0.06)]">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">
                Firebase
              </p>
              <div className="mt-4 space-y-3 text-sm text-zinc-700">
                <p>
                  <span className="font-semibold text-zinc-900">Status:</span>{' '}
                  {firebaseReady ? 'Environment variables found' : 'Environment variables missing'}
                </p>
                <p>
                  <span className="font-semibold text-zinc-900">App:</span>{' '}
                  {firebaseApp ? 'Firebase initialized' : 'Waiting for configuration'}
                </p>
                <p>
                  <span className="font-semibold text-zinc-900">Firestore:</span>{' '}
                  {firestoreDb ? 'Ready for product reads' : 'Waiting for Firebase config'}
                </p>
                <p className="text-zinc-600">
                  Copy <code>.env.example</code> to <code>.env.local</code> and fill in your Firebase project values.
                </p>
              </div>
            </article>

            {canManageProducts ? (
              <ProductAdminPanel products={products} onProductsChanged={reloadProducts} />
            ) : (
              <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_40px_rgba(24,24,27,0.06)]">
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">
                  Admin Access
                </p>
                <div className="mt-4 space-y-3 text-sm text-zinc-700">
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

            <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_40px_rgba(24,24,27,0.06)]">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">
                Products Foundation
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {productFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </article>
          </>
        )}

        <article className="rounded-[28px] border border-dashed border-black/15 bg-stone-50 p-5">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">
            Next Step
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Next we can tighten Firebase rules around the admin gate and prepare a clean commit + deploy flow for Telegram testing.
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.24em] text-stone-400">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <span
          className="h-5 w-5 rounded-full border border-white/15"
          style={{ backgroundColor: value ?? '#ffffff' }}
        />
        <span className="font-medium text-stone-100">{value ?? 'n/a'}</span>
      </div>
    </div>
  )
}
