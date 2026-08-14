import type { Product } from '../types/product'

export type ProductDiscountType = 'percentage' | 'fixed'

/**
 * Compute the effective (discounted) price a buyer pays for a product.
 *
 * Mirrors `applyProductDiscount` in functions/src/helpers.ts — the checkout
 * function recomputes the same value server-side, so a client-submitted cart
 * line price is only accepted when it matches this exact math.
 *
 * - `percentage` → price reduced by N% (clamped at 0, never negative)
 * - `fixed`     → price reduced by N EUR (clamped at 0, never negative)
 * - anything else → the base price, unchanged
 */
export function getProductEffectivePrice(
  price: number,
  discountType: ProductDiscountType | null | undefined,
  discountValue: number | null | undefined,
): number {
  if (discountType === 'percentage' && typeof discountValue === 'number' && discountValue > 0) {
    return Math.max(0, Math.round(price * (100 - Math.min(discountValue, 100))) / 100)
  }
  if (discountType === 'fixed' && typeof discountValue === 'number' && discountValue > 0) {
    return Math.max(0, Math.round((price - discountValue) * 100) / 100)
  }
  return price
}

/** Whether a product currently has an active discount (effective price < base). */
export function hasProductDiscount(product: Product): boolean {
  return (
    getProductEffectivePrice(product.price, product.discountType, product.discountValue) <
    product.price
  )
}

/** Round percentage saved (e.g. 20 for "-20%"), or null when not discounted. */
export function getProductDiscountPercent(product: Product): number | null {
  if (!hasProductDiscount(product)) return null
  const effective = getProductEffectivePrice(product.price, product.discountType, product.discountValue)
  return Math.round((1 - effective / product.price) * 100)
}

/** Amount saved in EUR, or null when not discounted. */
export function getProductDiscountAmount(product: Product): number | null {
  if (!hasProductDiscount(product)) return null
  return Math.round((product.price - getProductEffectivePrice(product.price, product.discountType, product.discountValue)) * 100) / 100
}

/** Discount badge text, language-neutral: "-20%" or "-5 EUR". */
export function getProductDiscountLabel(product: Product): string | null {
  const percent = getProductDiscountPercent(product)
  if (percent === null) return null
  const amount = getProductDiscountAmount(product)
  if (amount === null) return null
  if (product.discountType === 'fixed') {
    return `-${amount} ${product.currency}`
  }
  return `-${percent}%`
}
