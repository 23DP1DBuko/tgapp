# Firebase Schema

This document describes the first Firestore shape for the Telegram Mini App MVP.

## Goal

Keep the data model small, explicit, and easy to edit manually while the storefront is still being built.

## Collections To Start With

### `products`

Use this collection first. It is enough to support:
- product list
- product detail page
- category filtering
- manual availability control

Document shape:

```ts
type ProductDocument = {
  name: string
  description: string
  category: 'hoodies' | 'tshirts' | 'outerwear' | 'accessories' | 'other'
  brandNames: string[]
  price: number
  currency: 'EUR'
  isAvailable: boolean
  images: string[]
  createdAt: Timestamp
  isLimitedLabel?: string
}
```

Notes:
- Firestore document ID will act as the product `id` in the app.
- `brandNames` stays as a string array for now to avoid adding a separate brands collection too early.
- `createdAt` is stored as a Firestore timestamp.
- `images` stores Firebase Storage download URLs and supports multiple product images from the start.
- `isLimitedLabel` is optional and meant for manual labels like `1 of 1` or `Limited Drop`.

## Later Collections

### `orders`

Use this collection after checkout starts writing real order records.

Document shape:

```ts
type OrderDocument = {
  fullName: string
  telegramHandle: string
  telegramUserId?: number | null
  note: string
  fulfillmentType: 'delivery' | 'meetup'
  paymentMethod: 'meetup_cash' | 'usdt'
  deliveryCity: string
  deliveryAddress: string
  deliveryNotes: string
  meetupLocation: string
  meetupTimeOption: string
  meetupNotes: string
  items: {
    productId: string
    name: string
    price: number
    currency: 'EUR'
    image: string | null
  }[]
  subtotal: number
  appliedPromo: {
    code: string
    discountType: 'percentage' | 'fixed_amount'
    discountValue: number
    discountAmount: number
  } | null
  total: number
  status: 'new' | 'waiting_for_payment' | 'paid' | 'ready_for_meetup' | 'completed' | 'cancelled'
  cancelReason: string
  createdAt: Timestamp
}
```

Notes:
- `items` stores a snapshot of the purchased product data at checkout time.
- `fulfillmentType` decides whether this order is for delivery or meetup.
- `paymentMethod` stores how the buyer expects to pay after checkout.
- Delivery fields stay empty for meetup orders.
- Meetup fields stay empty for delivery orders.
- `subtotal` stores the amount before promo discounts.
- `appliedPromo` stores the exact promo snapshot used at checkout, if any.
- `status` starts as `new` for meetup cash orders and `waiting_for_payment` for USDT orders.
- `cancelReason` stays empty unless the admin cancels the order.
- `telegramUserId` is optional because browser dev mode may not have Telegram user data.

## Later Collections

Keep these in mind after products and orders are stable:
- `categories`
- `promoCodes`
- `dropSubscriptions`

### `promoCodes`

Use this collection once checkout supports applying discount codes.

Document shape:

```ts
type PromoCodeDocument = {
  code: string
  discountType: 'percentage' | 'fixed_amount'
  discountValue: number
  isActive: boolean
  expiresAt?: Timestamp | null
  usageLimit?: number | null
}
```

Notes:
- Store `code` in uppercase like `DROP10`.
- `percentage` uses `discountValue` as a percent like `10`.
- `fixed_amount` uses `discountValue` as a currency amount like `15`.
- `usageLimit` is validated on read, but it is not decremented yet in this MVP step.

## Example Promo Code Document

```json
{
  "code": "DROP10",
  "discountType": "percentage",
  "discountValue": 10,
  "isActive": true,
  "expiresAt": null,
  "usageLimit": null
}
```

## Example Product Document

```json
{
  "name": "YungWear Heavyweight Hoodie",
  "description": "Oversized streetwear hoodie with a heavyweight cotton feel.",
  "category": "hoodies",
  "brandNames": ["YungWear"],
  "price": 120,
  "currency": "EUR",
  "isAvailable": true,
  "images": [
    "https://firebasestorage.googleapis.com/..."
  ],
  "createdAt": "Firestore Timestamp",
  "isLimitedLabel": "Limited Drop"
}
```
