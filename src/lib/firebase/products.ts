import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore'

import { getFirestoreDb } from './firestore'
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
} from '../../types/product'

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
    images: Array.isArray(data.images) ? data.images : [],
    createdAt: data.createdAt ?? null,
    isLimitedLabel: data.isLimitedLabel,
  }
}

export async function listProducts(): Promise<Product[]> {
  const db = getFirestoreDb()

  if (!db) {
    return []
  }

  const productsQuery = query(
    collection(db, 'products'),
    orderBy('createdAt', 'desc'),
    limit(12),
  )

  const snapshot = await getDocs(productsQuery)

  return snapshot.docs.map((doc) => toProduct(doc as QueryDocumentSnapshot<ProductDocument>))
}

export async function createProduct(input: CreateProductInput): Promise<void> {
  const db = getFirestoreDb()

  if (!db) {
    throw new Error('Firebase is not configured yet.')
  }

  await addDoc(collection(db, 'products'), {
    name: input.name,
    description: input.description,
    category: input.category,
    brandNames: input.brandNames,
    price: input.price,
    currency: 'EUR',
    isAvailable: input.isAvailable,
    images: input.images,
    createdAt: serverTimestamp(),
    isLimitedLabel: input.isLimitedLabel || undefined,
  })
}

export async function updateProduct(
  productId: string,
  input: CreateProductInput,
): Promise<void> {
  const db = getFirestoreDb()

  if (!db) {
    throw new Error('Firebase is not configured yet.')
  }

  await updateDoc(doc(db, 'products', productId), {
    name: input.name,
    description: input.description,
    category: input.category,
    brandNames: input.brandNames,
    price: input.price,
    currency: 'EUR',
    isAvailable: input.isAvailable,
    images: input.images,
    isLimitedLabel: input.isLimitedLabel || undefined,
  })
}

export async function deleteProduct(productId: string): Promise<void> {
  const db = getFirestoreDb()

  if (!db) {
    throw new Error('Firebase is not configured yet.')
  }

  await deleteDoc(doc(db, 'products', productId))
}
