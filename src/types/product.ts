import type { Timestamp } from 'firebase/firestore'

export const PRODUCT_CATEGORIES = [
  'hoodies',
  'tshirts',
  'outerwear',
  'accessories',
  'other',
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export type Product = {
  id: string
  name: string
  description: string
  category: ProductCategory
  brandNames: string[]
  price: number
  currency: 'EUR'
  isAvailable: boolean
  images: string[]
  createdAt: Timestamp | null
  isLimitedLabel?: string
}
