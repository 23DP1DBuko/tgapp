import { useMemo, useState } from 'react'

import { getPromoCodeByCode, validatePromoCode } from '../lib/firebase/promoCodes'
import type { AppliedPromo } from '../types/promo'

export type UsePromoOptions = {
  checkoutSubtotal: number
  promoCodeRaw: string
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

export function usePromo(options: UsePromoOptions): UsePromoResult {
  const { checkoutSubtotal, promoCodeRaw } = options

  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null)
  const [isApplyingPromo, setIsApplyingPromo] = useState(false)

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
    } catch (error) {
      setAppliedPromo(null)
      setPromoFeedback(
        error instanceof Error ? error.message : 'Failed to apply promo code.',
      )
    } finally {
      setIsApplyingPromo(false)
    }
  }

  function clearPromo() {
    setAppliedPromo(null)
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
