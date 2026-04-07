import type { CartItem, CheckoutForm } from './cart'
import type { AppliedPromo } from './promo'

export type OrderStatus =
  | 'new'
  | 'waiting_for_payment'
  | 'paid'
  | 'ready_for_meetup'
  | 'completed'
  | 'cancelled'
export type PaymentMethod = CheckoutForm['paymentMethod']
export type FulfillmentType = CheckoutForm['fulfillmentType']

export type Order = {
  id: string
  fullName: CheckoutForm['fullName']
  telegramHandle: CheckoutForm['telegramHandle']
  telegramUserId?: number
  note: CheckoutForm['note']
  fulfillmentType: FulfillmentType
  paymentMethod: PaymentMethod
  deliveryCity: CheckoutForm['deliveryCity']
  deliveryAddress: CheckoutForm['deliveryAddress']
  deliveryNotes: CheckoutForm['deliveryNotes']
  meetupLocation: CheckoutForm['meetupLocation']
  meetupTimeOption: CheckoutForm['meetupTimeOption']
  meetupNotes: CheckoutForm['meetupNotes']
  items: CartItem[]
  subtotal: number
  appliedPromo: AppliedPromo | null
  total: number
  status: OrderStatus
  cancelReason: string
  createdAt: Date | null
}

export type CreateOrderInput = {
  fullName: CheckoutForm['fullName']
  telegramHandle: CheckoutForm['telegramHandle']
  telegramUserId?: number
  note: CheckoutForm['note']
  fulfillmentType: FulfillmentType
  paymentMethod: PaymentMethod
  deliveryCity: CheckoutForm['deliveryCity']
  deliveryAddress: CheckoutForm['deliveryAddress']
  deliveryNotes: CheckoutForm['deliveryNotes']
  meetupLocation: CheckoutForm['meetupLocation']
  meetupTimeOption: CheckoutForm['meetupTimeOption']
  meetupNotes: CheckoutForm['meetupNotes']
  items: CartItem[]
  subtotal: number
  appliedPromo: AppliedPromo | null
  total: number
  status: OrderStatus
  cancelReason: string
}
