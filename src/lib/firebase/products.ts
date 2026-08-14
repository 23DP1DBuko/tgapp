import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type Timestamp,
} from 'firebase/firestore'

import { getFirestoreDb } from './firestore'
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
} from '../../types/product'
import { withRetry, isTransientError, fetchWithTimeout } from '../retry'

const DEFAULT_ADMIN_UPSERT_PRODUCT_URL = '/api/admin/upsertProduct'
const DEFAULT_ADMIN_DELETE_PRODUCTS_URL = '/api/admin/deleteProducts'
const DEFAULT_UPDATE_PRODUCT_SIGNAL_URL = '/api/products/updateSignal'
const DEFAULT_ADMIN_SET_PRODUCT_DISCOUNT_URL = '/api/admin/setProductDiscount'

// Shared catalog cap (L3): previously the buyer catalog stopped at 12 and admin
// pickers at 50, so drops beyond that were invisible. A small curated store fits
// comfortably under this generous bound; revisit pagination only if it grows.
const PRODUCTS_QUERY_LIMIT = 500

type ProductDocument = Omit<Product, 'id' | 'createdAt'> & {
  createdAt?: Timestamp
}

export type CreateProductInput = {
  name: string
  description: string
  category: ProductCategory
  brandNames: string[]
  price: number
  isAvailable: boolean
  images: string[]
  isLimitedLabel?: string
  upcoming?: boolean
  earlyAccessAt?: string | null
  publicAt?: string | null
  /** Optional sale. Omit/undefined leaves any existing discount untouched. */
  discountType?: 'percentage' | 'fixed' | null
  discountValue?: number | null
}

export type SetProductDiscountInput = {
  discountType: 'percentage' | 'fixed' | null
  discountValue: number | null
}

function toProductAdminPayload(input: CreateProductInput) {
  const payload: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    category: input.category,
    brandNames: input.brandNames,
    price: input.price,
    isAvailable: input.isAvailable,
    images: input.images,
    isLimitedLabel: input.isLimitedLabel,
    upcoming: input.upcoming ?? false,
    earlyAccessAt: input.earlyAccessAt ?? null,
    publicAt: input.publicAt ?? null,
  }

  // Discount fields are only sent when explicitly provided, so the main
  // product form (which doesn't edit discounts) never wipes one set from the
  // Discounts admin page (the upsert uses merge semantics server-side).
  if (input.discountType !== undefined) {
    payload.discountType = input.discountType ?? null
  }
  if (input.discountValue !== undefined) {
    payload.discountValue = input.discountValue ?? null
  }

  return payload
}

async function readErrorReason(response: Response): Promise<string> {
  let reason = `http_${response.status}`
  let detail = ''

  try {
    const result = (await response.json()) as { reason?: string; detail?: string }
    if (typeof result.reason === 'string') {
      reason = result.reason
    }
    if (typeof result.detail === 'string' && result.detail) {
      detail = result.detail
    }
  } catch {
    // Keep HTTP fallback values.
  }

  return `${reason}${detail ? ` (${detail})` : ''}`
}

function toProduct(snapshot: QueryDocumentSnapshot<ProductDocument>): Product {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    name: data.name,
    description: data.description,
    category: PRODUCT_CATEGORIES.includes(data.category) ? data.category : 'other',
    brandNames: Array.isArray(data.brandNames) ? data.brandNames : [],
    price: typeof data.price === 'number' ? data.price : 0,
    currency: data.currency === 'EUR' ? 'EUR' : 'EUR',
    discountType:
      data.discountType === 'percentage' || data.discountType === 'fixed'
        ? data.discountType
        : null,
    discountValue: typeof data.discountValue === 'number' ? data.discountValue : null,
    isAvailable: Boolean(data.isAvailable),
    likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
    cartCount: typeof data.cartCount === 'number' ? data.cartCount : 0,
    images: Array.isArray(data.images) ? data.images : [],
    createdAt: data.createdAt ?? null,
    isLimitedLabel: data.isLimitedLabel,
    upcoming: data.upcoming,
    earlyAccessAt: data.earlyAccessAt ?? null,
    publicAt: data.publicAt ?? null,
  }
}

function toProducts(snapshot: QuerySnapshot<ProductDocument>): Product[] {
  return snapshot.docs.map((doc) => toProduct(doc as QueryDocumentSnapshot<ProductDocument>))
}

function getProductsQuery() {
  const db = getFirestoreDb()

  if (!db) {
    return null
  }

  return query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(PRODUCTS_QUERY_LIMIT))
}

function getAllProductsQuery() {
  const db = getFirestoreDb()

  if (!db) {
    return null
  }

  return query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(PRODUCTS_QUERY_LIMIT))
}

/**
 * Fetch the catalog (up to PRODUCTS_QUERY_LIMIT) for product pickers/modals.
 */
export async function listAllProducts(): Promise<Product[]> {
  const productsQuery = getAllProductsQuery()

  if (!productsQuery) {
    return []
  }

  const snapshot = await getDocs(productsQuery)

  return toProducts(snapshot as QuerySnapshot<ProductDocument>).filter(
    (product) => product.isAvailable,
  )
}

export async function listProducts(): Promise<Product[]> {
  const productsQuery = getProductsQuery()

  if (!productsQuery) {
    return []
  }

  const snapshot = await getDocs(productsQuery)

  return toProducts(snapshot as QuerySnapshot<ProductDocument>)
}

export function subscribeToProducts(
  onNext: (products: Product[]) => void,
  onError: (message: string) => void,
) {
  const productsQuery = getProductsQuery()

  if (!productsQuery) {
    onNext([])

    return () => undefined
  }

  return onSnapshot(
    productsQuery,
    (snapshot) => {
      onNext(toProducts(snapshot as QuerySnapshot<ProductDocument>))
    },
    (error) => {
      onError(error.message || 'Failed to subscribe to products from Firestore.')
    },
  )
}

/**
 * Upsert a product (create or update) with timeout + transient retry.
 * Throws a descriptive error on failure.
 */
export async function createProduct(initData: string, input: CreateProductInput): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_UPSERT_PRODUCT_URL || DEFAULT_ADMIN_UPSERT_PRODUCT_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          product: toProductAdminPayload(input),
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function updateProduct(
  initData: string,
  productId: string,
  input: CreateProductInput,
): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_UPSERT_PRODUCT_URL || DEFAULT_ADMIN_UPSERT_PRODUCT_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          productId,
          product: toProductAdminPayload(input),
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function updateProductLikesCount(
  initData: string,
  productId: string,
  delta: 1 | -1,
): Promise<void> {
  await withRetry(async () => {
    const response = await fetch(
      import.meta.env.VITE_UPDATE_PRODUCT_SIGNAL_URL || DEFAULT_UPDATE_PRODUCT_SIGNAL_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          productId,
          signal: 'likesCount',
          delta,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to update likes: ${await readErrorReason(response)}.`)
    }
  }, { maxRetries: 2, shouldRetry: isTransientError })
}

export async function updateProductCartCount(
  initData: string,
  productId: string,
  delta: 1 | -1,
): Promise<void> {
  await withRetry(async () => {
    const response = await fetch(
      import.meta.env.VITE_UPDATE_PRODUCT_SIGNAL_URL || DEFAULT_UPDATE_PRODUCT_SIGNAL_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          productId,
          signal: 'cartCount',
          delta,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to update cart count: ${await readErrorReason(response)}.`)
    }
  }, { maxRetries: 2, shouldRetry: isTransientError })
}

/**
 * Set or remove a product's discount (admin only). `discountType: null` clears it.
 * Throws a descriptive error on failure.
 */
export async function setProductDiscount(
  initData: string,
  productId: string,
  input: SetProductDiscountInput,
): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_SET_PRODUCT_DISCOUNT_URL || DEFAULT_ADMIN_SET_PRODUCT_DISCOUNT_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          productId,
          discount: input,
        }),
      },
    )

    // The backend always answers with JSON. A non-JSON success (e.g. the SPA
    // index.html when the hosting rewrite for this endpoint is missing) would
    // otherwise look like a silent success while nothing is persisted.
    const isJson =
      (response.headers.get('content-type') ?? '').includes('application/json')
    if (!response.ok || !isJson) {
      throw new Error(
        isJson
          ? `${await readErrorReason(response)}`
          : 'Discount endpoint not reachable — redeploy functions & hosting, then retry.',
      )
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })
}

export async function deleteProduct(initData: string, productId: string): Promise<void> {
  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_DELETE_PRODUCTS_URL || DEFAULT_ADMIN_DELETE_PRODUCTS_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          productIds: [productId],
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })}



export async function deleteSoldProducts(initData: string, products: Product[]): Promise<void> {
  const soldProducts = products.filter((product) => !product.isAvailable)

  if (soldProducts.length === 0) {
    return
  }

  await withRetry(async () => {
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_DELETE_PRODUCTS_URL || DEFAULT_ADMIN_DELETE_PRODUCTS_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          productIds: soldProducts.map((product) => product.id),
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`${await readErrorReason(response)}`)
    }
  }, { maxRetries: 1, shouldRetry: isTransientError })}


