import { useEffect, useState } from 'react'

import { createOrder, CreateOrderError } from '../lib/firebase/orders'
import {
  readStoredSessionJson,
  writeStoredSessionJson,
  removeStoredSessionValue,
} from '../lib/storage'
import { EARLY_ACCESS_REFERRAL_THRESHOLD, referralFriendsWord } from '../lib/earlyAccess'
import { translate } from '../lib/i18n/translate'
import type { TranslationKey } from '../lib/i18n/translations'
import type {
  CheckoutForm,
  CheckoutSubmitState,
  CheckoutSuccessSnapshot,
} from '../types/cart'
import type { AppliedPromo } from '../types/promo'
import type { CartItem } from '../types/cart'
import type { TelegramUser } from '../lib/telegram/webApp'

export type UseCheckoutOptions = {
  user: TelegramUser | undefined
  initData: string
  requireTelegramAccess: (actionKey: TranslationKey) => boolean
  cartItems: CartItem[]
  checkoutSubtotal: number
  appliedPromo: AppliedPromo | null
  checkoutTotal: number
  hasPendingPromoCode: boolean
  clearCart: () => void
  clearPromo: () => void
  reloadProducts: () => void
  onNavigateToCheckout: () => void
  onCheckoutSuccess: () => void
  onPromoCodeChange?: (value: string) => void
  initialCheckoutSubmitted: boolean
  initialOrderId: string | null
  initialSuccessSnapshot: CheckoutSuccessSnapshot | null
}

export type UseCheckoutResult = {
  checkoutForm: CheckoutForm
  checkoutSubmitted: boolean
  checkoutSubmitState: CheckoutSubmitState
  checkoutError: string | null
  fieldErrors: Partial<Record<keyof CheckoutForm, string>>
  createdOrderId: string | null
  checkoutSuccessSnapshot: CheckoutSuccessSnapshot | null
  telegramUserLabel: string
  telegramContactHint: string
  handleCheckoutFieldChange: (field: keyof CheckoutForm, value: string) => void
  handleSubmitCheckout: () => Promise<void>
  handleOpenCheckout: () => void
  setCheckoutError: React.Dispatch<React.SetStateAction<string | null>>
}

const CHECKOUT_DRAFT_KEY = 'yungwear-checkout-draft'
const CHECKOUT_IDEMPOTENCY_KEY = 'yungwear-checkout-idempotency-key'

/** Fresh client-side idempotency key (UUID when available). */
function createClientOrderId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Reuse the persisted key across retries so a refresh / double-tap after a
 * lost response maps to the same order (M4); mint a fresh one only if absent.
 */
function getOrCreateClientOrderId(): string {
  const persisted = readStoredSessionJson<string>(CHECKOUT_IDEMPOTENCY_KEY, '')
  if (/^[A-Za-z0-9_-]{8,80}$/.test(persisted)) {
    return persisted
  }
  const next = createClientOrderId()
  writeStoredSessionJson(CHECKOUT_IDEMPOTENCY_KEY, next)
  return next
}

/** Backend checkout rejection reasons we translate; anything else falls back. */
const CHECKOUT_REASON_KEYS: Partial<Record<string, TranslationKey>> = {
  product_unavailable: 'coError.productUnavailable',
  giveaway_prize: 'coError.giveawayPrize',
  promo_exhausted: 'coError.promoExhausted',
  promo_invalid: 'coError.promoInvalid',
  promo_inactive: 'coError.promoInactive',
  promo_expired: 'coError.promoExpired',
  drop_not_started: 'coError.dropNotStarted',
  invalid_init_data: 'coError.sessionExpired',
  expired_init_data: 'coError.sessionExpired',
}

/** Localized early-access rejection with the threshold interpolated. */
function translateEarlyAccessRestricted(): string {
  return translate('coError.earlyAccessRestricted', {
    needed: EARLY_ACCESS_REFERRAL_THRESHOLD,
    friends: referralFriendsWord(),
  })
}

/** Map a checkout failure to a localized, actionable message. */
function translateCheckoutError(error: unknown): string {
  if (error instanceof CreateOrderError) {
    if (error.reason === 'early_access_restricted') {
      return translateEarlyAccessRestricted()
    }
    const key = CHECKOUT_REASON_KEYS[error.reason]
    if (key) return translate(key)
  }
  return error instanceof Error ? error.message : translate('coError.failedSold')
}

/** Fresh checkout form, prefilled from the Telegram user where possible. */
function checkoutDefaults(user: TelegramUser | undefined): CheckoutForm {
  return {
    fullName: `${user?.first_name ?? ''}${user?.last_name ? ` ${user.last_name}` : ''}`.trim(),
    telegramHandle: user?.username ? `@${user.username}` : '',
    note: '',
    promoCode: '',
    fulfillmentType: 'meetup',
    paymentMethod: 'meetup_cash',
    deliveryCity: '',
    deliveryAddress: '',
    deliveryNotes: '',
    meetupLocation: '',
    meetupTimeOption: '',
    meetupTimeCustom: '',
    meetupNotes: '',
  }
}

export function useCheckout(options: UseCheckoutOptions): UseCheckoutResult {
  const {
    user,
    requireTelegramAccess,
    cartItems,
    checkoutSubtotal,
    appliedPromo,
    checkoutTotal,
    hasPendingPromoCode,
    clearCart,
    clearPromo,
    reloadProducts,
    onNavigateToCheckout,
    onCheckoutSuccess,
    onPromoCodeChange,
    initialCheckoutSubmitted,
    initialOrderId,
    initialSuccessSnapshot,
  } = options

  // Restore an in-progress draft over the Telegram prefill. The promo code is
  // always cleared on restore: it isn't re-validated until the user applies it.
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>(() => {
    const defaults = checkoutDefaults(user)
    // Whitelist restore: only known string fields are copied back, so a
    // malformed or legacy draft can never inject unknown keys or shapes.
    const draft = readStoredSessionJson<Partial<Record<keyof CheckoutForm, string>>>(CHECKOUT_DRAFT_KEY, {})
    const safeDraft: Partial<CheckoutForm> = {}
    for (const key of Object.keys(defaults) as (keyof CheckoutForm)[]) {
      const value = draft[key]
      if (typeof value === 'string') {
        ;(safeDraft as Record<string, unknown>)[key] = value
      }
    }
    return { ...defaults, ...safeDraft, promoCode: '' }
  })
  const [checkoutSubmitted, setCheckoutSubmitted] = useState(initialCheckoutSubmitted)
  const [checkoutSubmitState, setCheckoutSubmitState] =
    useState<CheckoutSubmitState>('idle')
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({})
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(initialOrderId)
  const [checkoutSuccessSnapshot, setCheckoutSuccessSnapshot] =
    useState<CheckoutSuccessSnapshot | null>(initialSuccessSnapshot)

  // Draft persistence: keep typed fields across interruptions (app switch /
  // reload). Never save while the success screen is showing.
  useEffect(() => {
    if (checkoutSubmitted) return
    writeStoredSessionJson(CHECKOUT_DRAFT_KEY, checkoutForm)
  }, [checkoutForm, checkoutSubmitted])

  // Computed per render so they follow language changes.
  const telegramUserLabel = (() => {
    if (user?.username) {
      return `@${user.username}`
    }

    if (user?.first_name) {
      return `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`.trim()
    }

    if (user?.id) {
      return translate('coUserLabel.telegramUser', { id: user.id })
    }

    return translate('coUserLabel.openTelegram')
  })()

  const telegramContactHint = (() => {
    if (user?.username) {
      return translate('coHint.linkedTo', { label: telegramUserLabel })
    }

    if (user?.id) {
      return translate('coHint.linkedToId', { id: user.id })
    }

    return translate('coHint.telegramOnly')
  })()

  function handleCheckoutFieldChange(field: keyof CheckoutForm, value: string) {
    // Clear field-level error when user edits the field
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      if (Object.keys(next).length === 0) {
        setCheckoutError(null)
      }
      return next
    })

    setCheckoutForm((currentForm) => {
      if (field === 'fulfillmentType' && value === 'delivery') {
        return {
          ...currentForm,
          fulfillmentType: 'delivery',
          paymentMethod: 'usdt',
          meetupLocation: '',
          meetupTimeOption: '',
          meetupTimeCustom: '',
          meetupNotes: '',
        }
      }

      if (field === 'fulfillmentType' && value === 'meetup') {
        return {
          ...currentForm,
          fulfillmentType: 'meetup',
          paymentMethod:
            currentForm.paymentMethod === 'usdt' ? 'usdt' : 'meetup_cash',
          deliveryCity: '',
          deliveryAddress: '',
          deliveryNotes: '',
        }
      }

      return {
        ...currentForm,
        [field]: value,
      }
    })

    if (field === 'promoCode') {
      clearPromo()
      onPromoCodeChange?.(value)
    }
  }

  function handleOpenCheckout() {
    if (!requireTelegramAccess('gateAction.checkout')) {
      return
    }

    if (cartItems.length === 0) {
      // Button is already disabled when cart is empty; this is a safety net
      return
    }

    setCheckoutSubmitted(false)
    setCheckoutSubmitState('idle')
    setCheckoutError(null)
    setFieldErrors({})
    setCreatedOrderId(null)
    setCheckoutSuccessSnapshot(null)
    clearPromo()
    onNavigateToCheckout()
  }

  async function handleSubmitCheckout() {
    if (!requireTelegramAccess('gateAction.checkout')) {
      return
    }

    if (checkoutSubmitState === 'submitting') {
      return
    }

    const trimmedName = checkoutForm.fullName.trim()
    const normalizedTelegramHandle = user?.username
      ? `@${user.username}`
      : user?.id
        ? `tg_user_${user.id}`
        : ''

    if (cartItems.length === 0) {
      setCheckoutError(translate('coError.noProducts'))
      return
    }

    if (!trimmedName || !user?.id || !normalizedTelegramHandle) {
      setCheckoutError(translate('coError.telegramRequired'))
      return
    }

    // Collect field-level errors first so user sees all issues at once
    const nextFieldErrors: Partial<Record<keyof CheckoutForm, string>> = {}

    if (checkoutForm.fulfillmentType === 'delivery') {
      if (!checkoutForm.deliveryCity.trim()) {
        nextFieldErrors.deliveryCity = translate('coError.cityRequired')
      }
      if (!checkoutForm.deliveryAddress.trim()) {
        nextFieldErrors.deliveryAddress = translate('coError.addressRequired')
      }
    }

    if (checkoutForm.fulfillmentType === 'meetup') {
      if (!checkoutForm.meetupLocation) {
        nextFieldErrors.meetupLocation = translate('coError.meetupLocationRequired')
      }
      // "Other location" selected but no custom location typed — an order
      // with an empty meetup spot would leave the admin guessing.
      if (
        checkoutForm.meetupLocation === '__other__' &&
        !checkoutForm.deliveryAddress.trim()
      ) {
        nextFieldErrors.deliveryAddress = translate('coError.locationRequired')
      }
      if (
        checkoutForm.meetupTimeOption === '__other__' &&
        !checkoutForm.meetupTimeCustom.trim()
      ) {
        nextFieldErrors.meetupTimeCustom = translate('coError.timeRequired')
      }
      // meetupTimeOption is optional per UI — user can specify in notes
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setCheckoutError(translate('coError.fixFields'))
      return
    }

    setFieldErrors({})

    if (hasPendingPromoCode) {
      setCheckoutError(translate('coError.promoPending'))
      return
    }

    try {
      setCheckoutSubmitState('submitting')
      const initialStatus =
        checkoutForm.paymentMethod === 'usdt' ? 'waiting_for_payment' : 'new'
      const clientOrderId = getOrCreateClientOrderId()

      const orderId = await createOrder({
        initData: options.initData,
        clientOrderId,
        fullName: trimmedName,
        telegramHandle: normalizedTelegramHandle,
        telegramUserId: user?.id,
        note: checkoutForm.note.trim(),
        fulfillmentType: checkoutForm.fulfillmentType,
        paymentMethod: checkoutForm.paymentMethod,
        deliveryCity: checkoutForm.deliveryCity.trim(),
        deliveryAddress: checkoutForm.deliveryAddress.trim(),
        deliveryNotes: checkoutForm.deliveryNotes.trim(),
        // 'Other location/time' resolve to the typed text so the order doc
        // stores the actual value (displays fall back to the raw string).
        meetupLocation:
          checkoutForm.meetupLocation === '__other__'
            ? checkoutForm.deliveryAddress.trim().slice(0, 80)
            : checkoutForm.meetupLocation,
        meetupTimeOption:
          checkoutForm.meetupTimeOption === '__other__'
            ? checkoutForm.meetupTimeCustom.trim().slice(0, 80)
            : checkoutForm.meetupTimeOption,
        meetupNotes: checkoutForm.meetupNotes.trim(),
        items: cartItems,
        subtotal: checkoutSubtotal,
        appliedPromo,
        total: checkoutTotal,
        status: initialStatus,
        cancelReason: '',
      })

      setCheckoutError(null)
      setFieldErrors({})
      setCreatedOrderId(orderId)
      setCheckoutSuccessSnapshot({
        items: cartItems.map((item) => ({ ...item })),
        form: { ...checkoutForm },
        total: checkoutTotal,
      })
      setCheckoutSubmitted(true)
      // The idempotency key has served its purpose: clear it so the next
      // checkout session mints a fresh one. Failed attempts keep it, so a
      // back-and-retry after a lost response converges to the same order.
      removeStoredSessionValue(CHECKOUT_IDEMPOTENCY_KEY)
      clearCart()
      clearPromo()
      setCheckoutForm((currentForm) => ({
        ...currentForm,
        note: '',
        promoCode: '',
        fulfillmentType: 'meetup',
        paymentMethod: 'meetup_cash',
        deliveryCity: '',
        deliveryAddress: '',
        deliveryNotes: '',
        meetupLocation: '',
        meetupTimeOption: '',
        meetupTimeCustom: '',
        meetupNotes: '',
      }))
      onCheckoutSuccess()
      await reloadProducts()
    } catch (error) {
      setCheckoutError(translateCheckoutError(error))
    } finally {
      setCheckoutSubmitState('idle')
    }
  }

  return {
    checkoutForm,
    checkoutSubmitted,
    checkoutSubmitState,
    checkoutError,
    fieldErrors,
    createdOrderId,
    checkoutSuccessSnapshot,
    telegramUserLabel,
    telegramContactHint,
    handleCheckoutFieldChange,
    handleSubmitCheckout,
    handleOpenCheckout,
    setCheckoutError,
  }
}
