import { useMemo, useState } from 'react'

import { createOrder } from '../lib/firebase/orders'
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
  requireTelegramAccess: (action: string) => boolean
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
  createdOrderId: string | null
  checkoutSuccessSnapshot: CheckoutSuccessSnapshot | null
  telegramUserLabel: string
  telegramContactHint: string
  handleCheckoutFieldChange: (field: keyof CheckoutForm, value: string) => void
  handleSubmitCheckout: () => Promise<void>
  handleOpenCheckout: () => void
  setCheckoutError: React.Dispatch<React.SetStateAction<string | null>>
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

  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
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
    meetupNotes: '',
  })
  const [checkoutSubmitted, setCheckoutSubmitted] = useState(initialCheckoutSubmitted)
  const [checkoutSubmitState, setCheckoutSubmitState] =
    useState<CheckoutSubmitState>('idle')
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(initialOrderId)
  const [checkoutSuccessSnapshot, setCheckoutSuccessSnapshot] =
    useState<CheckoutSuccessSnapshot | null>(initialSuccessSnapshot)

  const telegramUserLabel = useMemo(() => {
    if (user?.username) {
      return `@${user.username}`
    }

    if (user?.first_name) {
      return `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`.trim()
    }

    if (user?.id) {
      return `Telegram user ${user.id}`
    }

    return 'Open in Telegram to connect your account'
  }, [user])

  const telegramContactHint = useMemo(() => {
    if (user?.username) {
      return `Orders will be linked to ${telegramUserLabel} and your Telegram user ID.`
    }

    if (user?.id) {
      return `Orders will be linked to your Telegram user ID ${user.id}, even without a public username.`
    }

    return 'Checkout works only inside the Telegram Mini App.'
  }, [telegramUserLabel, user])

  function handleCheckoutFieldChange(field: keyof CheckoutForm, value: string) {
    setCheckoutForm((currentForm) => {
      if (field === 'fulfillmentType' && value === 'delivery') {
        return {
          ...currentForm,
          fulfillmentType: 'delivery',
          paymentMethod: 'usdt',
          meetupLocation: '',
          meetupTimeOption: '',
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
    if (!requireTelegramAccess('Checkout')) {
      return
    }

    if (cartItems.length === 0) {
      // Button is already disabled when cart is empty; this is a safety net
      return
    }

    setCheckoutSubmitted(false)
    setCheckoutSubmitState('idle')
    setCheckoutError(null)
    setCreatedOrderId(null)
    setCheckoutSuccessSnapshot(null)
    clearPromo()
    onNavigateToCheckout()
  }

  async function handleSubmitCheckout() {
    if (!requireTelegramAccess('Checkout')) {
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
      setCheckoutError('Add at least one product before checkout.')
      return
    }

    if (!trimmedName || !user?.id || !normalizedTelegramHandle) {
      setCheckoutError('Open the Mini App in Telegram with a real account before checkout.')
      return
    }

    if (checkoutForm.fulfillmentType === 'delivery') {
      if (!checkoutForm.deliveryCity.trim() || !checkoutForm.deliveryAddress.trim()) {
        setCheckoutError('Delivery city and address are required.')
        return
      }
    }

    if (checkoutForm.fulfillmentType === 'meetup') {
      if (!checkoutForm.meetupLocation || !checkoutForm.meetupTimeOption) {
        setCheckoutError('Select a meetup location and time option.')
        return
      }
    }

    if (hasPendingPromoCode) {
      setCheckoutError('Apply the promo code first, or clear it before checkout.')
      return
    }

    try {
      setCheckoutSubmitState('submitting')
      const initialStatus =
        checkoutForm.paymentMethod === 'usdt' ? 'waiting_for_payment' : 'new'

      const orderId = await createOrder({
        initData: options.initData,
        fullName: trimmedName,
        telegramHandle: normalizedTelegramHandle,
        telegramUserId: user?.id,
        note: checkoutForm.note.trim(),
        fulfillmentType: checkoutForm.fulfillmentType,
        paymentMethod: checkoutForm.paymentMethod,
        deliveryCity: checkoutForm.deliveryCity.trim(),
        deliveryAddress: checkoutForm.deliveryAddress.trim(),
        deliveryNotes: checkoutForm.deliveryNotes.trim(),
        meetupLocation: checkoutForm.meetupLocation,
        meetupTimeOption: checkoutForm.meetupTimeOption,
        meetupNotes: checkoutForm.meetupNotes.trim(),
        items: cartItems,
        subtotal: checkoutSubtotal,
        appliedPromo,
        total: checkoutTotal,
        status: initialStatus,
        cancelReason: '',
      })

      setCheckoutError(null)
      setCreatedOrderId(orderId)
      setCheckoutSuccessSnapshot({
        items: cartItems.map((item) => ({ ...item })),
        form: { ...checkoutForm },
        total: checkoutTotal,
      })
      setCheckoutSubmitted(true)
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
        meetupNotes: '',
      }))
      onCheckoutSuccess()
      await reloadProducts()
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : 'Failed to mark items as sold.',
      )
    } finally {
      setCheckoutSubmitState('idle')
    }
  }

  return {
    checkoutForm,
    checkoutSubmitted,
    checkoutSubmitState,
    checkoutError,
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
