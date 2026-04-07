import type { Product } from './product'

export type CartItem = {
  productId: Product['id']
  name: Product['name']
  price: Product['price']
  currency: Product['currency']
  image: string | null
}

export type CheckoutForm = {
  fullName: string
  telegramHandle: string
  note: string
  promoCode: string
  fulfillmentType: 'delivery' | 'meetup'
  paymentMethod: 'meetup_cash' | 'usdt'
  deliveryCity: string
  deliveryAddress: string
  deliveryNotes: string
  meetupLocation: string
  meetupTimeOption: string
  meetupNotes: string
}
