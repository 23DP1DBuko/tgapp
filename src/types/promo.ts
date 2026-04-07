export const PROMO_DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const

export type PromoDiscountType = (typeof PROMO_DISCOUNT_TYPES)[number]

export type PromoCode = {
  id: string
  code: string
  discountType: PromoDiscountType
  discountValue: number
  isActive: boolean
  expiresAt: Date | null
  usageLimit: number | null
}

export type AppliedPromo = {
  code: PromoCode['code']
  discountType: PromoCode['discountType']
  discountValue: PromoCode['discountValue']
  discountAmount: number
}
