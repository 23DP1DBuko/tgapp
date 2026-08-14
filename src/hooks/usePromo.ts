import { useMemo, useState } from 'react'

import {
  applyPromoCode,
  computePromoDiscountAmount,
  type ApplyPromoRejectionReason,
} from '../lib/firebase/promoCodes'
import { translate } from '../lib/i18n/translate'
import type { TranslationKey } from '../lib/i18n/translations'
import type { AppliedPromo } from '../types/promo'

export type UsePromoOptions = {
  checkoutSubtotal: number
  promoCodeRaw: string
  initData: string
}

export type UsePromoResult = {
  appliedPromo: AppliedPromo | null
  promoFeedback: string | null
  isApplyingPromo: boolean
  checkoutTotal: number
  hasPendingPromoCode: boolean
  handleApplyPromo: () => Promise<void>
  clearPromo: () => void
}

const PROMO_REJECTION_KEYS: Record<ApplyPromoRejectionReason, TranslationKey> = {
  promo_not_found: 'promo.notFound',
  promo_inactive: 'promo.inactive',
  promo_expired: 'promo.expired',
  promo_exhausted: 'promo.exhausted',
  promo_no_discount: 'promo.noDiscount',
}

export function usePromo(options: UsePromoOptions): UsePromoResult {
  const { checkoutSubtotal, promoCodeRaw, initData } = options

  const [rawAppliedPromo, setRawAppliedPromo] = useState<AppliedPromo | null>(null)
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null)
  const [isApplyingPromo, setIsApplyingPromo] = useState(false)

  // Keep the applied discount in sync with the live subtotal so the submitted
  // order always matches the server-side recomputation (e.g. after an item is
  // removed on the checkout review step).
  const appliedPromo = useMemo(() => {
    if (!rawAppliedPromo) return null
    return {
      ...rawAppliedPromo,
      discountAmount: computePromoDiscountAmount(rawAppliedPromo, checkoutSubtotal),
    }
  }, [rawAppliedPromo, checkoutSubtotal])

  const checkoutTotal = useMemo(
    () => Math.max(0, checkoutSubtotal - (appliedPromo?.discountAmount ?? 0)),
    [appliedPromo, checkoutSubtotal],
  )

  const hasPendingPromoCode = useMemo(() => {
    const normalizedTypedCode = promoCodeRaw.trim().toUpperCase()
    const appliedCode = appliedPromo?.code ?? ''

    if (!normalizedTypedCode) {
      return false
    }

    return normalizedTypedCode !== appliedCode
  }, [appliedPromo, promoCodeRaw])

  async function handleApplyPromo() {
    const normalizedCode = promoCodeRaw.trim().toUpperCase()

    if (!normalizedCode) {
      setRawAppliedPromo(null)
      setPromoFeedback(translate('promo.enterCode'))
      return
    }

    try {
      setIsApplyingPromo(true)
      const result = await applyPromoCode(initData, normalizedCode, checkoutSubtotal)

      if (!result.ok) {
        setRawAppliedPromo(null)
        setPromoFeedback(translate(PROMO_REJECTION_KEYS[result.reason]))
        return
      }

      setRawAppliedPromo(result.promo)
      setPromoFeedback(translate('promo.applied', { code: result.promo.code }))
    } catch (error) {
      setRawAppliedPromo(null)
      const message = error instanceof Error ? error.message : ''
      // Raw backend reason tokens (session failures in the browser fallback,
      // missing_bot_token, internal_error, or http_* from a non-API response)
      // are not user-facing — fall back to the generic message.
      const isBareReason =
        !message ||
        /^(http_\d+|invalid_init_data|expired_init_data|missing_bot_token|internal_error|invalid_payload)$/.test(
          message,
        )
      setPromoFeedback(isBareReason ? translate('promo.failed') : message)
    } finally {
      setIsApplyingPromo(false)
    }
  }

  function clearPromo() {
    setRawAppliedPromo(null)
    setPromoFeedback(null)
  }

  return {
    appliedPromo,
    promoFeedback,
    isApplyingPromo,
    checkoutTotal,
    hasPendingPromoCode,
    handleApplyPromo,
    clearPromo,
  }
}
