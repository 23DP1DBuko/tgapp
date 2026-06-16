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

const DEFAULT_ADMIN_UPSERT_PRODUCT_URL = '/api/admin/upsertProduct'
const DEFAULT_ADMIN_DELETE_PRODUCTS_URL = '/api/admin/deleteProducts'
const DEFAULT_UPDATE_PRODUCT_SIGNAL_URL = '/api/products/updateSignal'

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
}

function toProductAdminPayload(input: CreateProductInput) {
  return {
    name: input.name,
    description: input.description,
    category: input.category,
    brandNames: input.brandNames,
    price: input.price,
    isAvailable: input.isAvailable,
    images: input.images,
    isLimitedLabel: input.isLimitedLabel,
  }
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
    isAvailable: Boolean(data.isAvailable),
    likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
    cartCount: typeof data.cartCount === 'number' ? data.cartCount : 0,
    images: Array.isArray(data.images) ? data.images : [],
    createdAt: data.createdAt ?? null,
    isLimitedLabel: data.isLimitedLabel,
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

  return query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(12))
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

export async function createProduct(initData: string, input: CreateProductInput): Promise<void> {
  const response = await fetch(
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
    throw new Error(`Failed to save product: ${await readErrorReason(response)}.`)
  }
}

export async function updateProduct(
  initData: string,
  productId: string,
  input: CreateProductInput,
): Promise<void> {
  const response = await fetch(
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
    throw new Error(`Failed to save product: ${await readErrorReason(response)}.`)
  }
}

export async function updateProductLikesCount(
  productId: string,
  delta: 1 | -1,
): Promise<void> {
  const response = await fetch(
    import.meta.env.VITE_UPDATE_PRODUCT_SIGNAL_URL || DEFAULT_UPDATE_PRODUCT_SIGNAL_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        signal: 'likesCount',
        delta,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to update likes: ${await readErrorReason(response)}.`)
  }
}

export async function updateProductCartCount(
  productId: string,
  delta: 1 | -1,
): Promise<void> {
  const response = await fetch(
    import.meta.env.VITE_UPDATE_PRODUCT_SIGNAL_URL || DEFAULT_UPDATE_PRODUCT_SIGNAL_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        signal: 'cartCount',
        delta,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to update cart count: ${await readErrorReason(response)}.`)
  }
}

export async function deleteProduct(initData: string, productId: string): Promise<void> {
  const response = await fetch(
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
    throw new Error(`Failed to delete product: ${await readErrorReason(response)}.`)
  }
}

export async function deleteSoldProducts(initData: string, products: Product[]): Promise<void> {
  const soldProducts = products.filter((product) => !product.isAvailable)

  if (soldProducts.length === 0) {
    return
  }

  const response = await fetch(
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
    throw new Error(`Failed to delete sold products: ${await readErrorReason(response)}.`)
  }
}
