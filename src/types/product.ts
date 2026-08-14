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
  /** Optional sale: 'percentage' or 'fixed' amount off `price`. */
  discountType?: 'percentage' | 'fixed' | null
  discountValue?: number | null
  isAvailable: boolean
  likesCount: number
  cartCount: number
  images: string[]
  createdAt: Timestamp | null
  isLimitedLabel?: string
  upcoming?: boolean
  earlyAccessAt?: Timestamp | null
  publicAt?: Timestamp | null
}
