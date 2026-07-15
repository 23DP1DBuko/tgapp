# Firebase Schema

This document describes the current Firestore shape for the Telegram Mini App.

## Goal

Keep the data model small, explicit, and aligned with the current application code.
Source code is the source of truth.
This document should reflect the actual types used by the app, not older planning assumptions.

---

## Core collections

### `products`

This collection supports:
- product catalog
- product detail page
- category filtering
- manual availability control
- shared storefront counters such as likes and cart activity

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
  likesCount: number
  cartCount: number
  images: string[]
  createdAt: Timestamp | null
  isLimitedLabel?: string
  upcoming?: boolean
  earlyAccessAt?: string | null
  publicAt?: string | null
}
```

Notes:
- Firestore document ID acts as the product `id` in the app.
- `brandNames` stays as a string array to avoid introducing a separate brands collection too early.
- `createdAt` is stored as a Firestore timestamp and may be `null` in local or transitional states.
- `likesCount` is a shared storefront signal for how many users liked the item.
- `cartCount` is a shared storefront signal for how many users currently have the item in cart.
- `images` stores Firebase Storage download URLs and supports multiple product images.
- `isLimitedLabel` is optional and is used for manual labels such as `1 of 1` or `Limited Drop`.
- `upcoming` is an optional boolean to mark a product as upcoming.
- `earlyAccessAt` is an optional ISO datetime string for the start of early access windows.
- `publicAt` is an optional ISO datetime string for when public release begins.
- `reservedBy` is an optional number storing the Telegram user ID who currently has a reservation hold on the product.
- `reservedUntil` is an optional Timestamp indicating when the current reservation expires. When this time passes, the product can be reserved by another buyer. Both `reservedBy` and `reservedUntil` are set/cleared together by the `reserveProduct` and `releaseReservation` Cloud Functions, and are cleared during successful checkout. The reservation duration defaults to 15 minutes and is configurable via the `RESERVATION_DURATION_MS` environment variable on Cloud Functions.

---

### `orders`

This collection stores checkout submissions written by the storefront.

Document shape:

```ts
type OrderDocument = {
  fullName: string
  telegramHandle: string
  telegramUserId?: number
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
  createdAt: Timestamp | null
}
```

Notes:
- Firestore document ID acts as the order `id` in the app.
- `items` stores a snapshot of the purchased cart items at checkout time.
- Each item keeps `productId`, `name`, `price`, `currency`, and `image` so order history stays stable even if product data changes later.
- `fulfillmentType` decides whether the order is for delivery or meetup.
- `paymentMethod` stores how the buyer expects to pay after checkout.
- Delivery fields remain empty for meetup orders.
- Meetup fields remain empty for delivery orders.
- `subtotal` stores the amount before promo discounts.
- `appliedPromo` stores the exact promo snapshot used during checkout, if any.
- `status` starts as `new` for meetup cash orders and `waiting_for_payment` for USDT orders.
- `cancelReason` stays empty unless the admin cancels the order.
- `telegramUserId` is optional because some dev or fallback flows may not have Telegram user data.
- `createdAt` is stored as a Firestore timestamp and may be `null` in transitional app state before hydration.

---

### `promoCodes`

This collection stores promo codes used during checkout.

Document shape:

```ts
type PromoCodeDocument = {
  code: string
  discountType: 'percentage' | 'fixed_amount'
  discountValue: number
  isActive: boolean
  expiresAt: Timestamp | null
  usageLimit: number | null
  usageCount?: number
}
```

Notes:
- Store `code` in uppercase, for example `DROP10`.
- `percentage` uses `discountValue` as a percent like `10`.
- `fixed_amount` uses `discountValue` as a currency amount like `15`.
- `expiresAt` may be `null` when the promo has no expiration date.
- `usageLimit` may be `null` when the promo has no hard limit.
- `usageCount` tracks how many times the promo has been used. It is incremented atomically inside the checkout transaction. When `usageLimit` is set and `usageCount >= usageLimit`, the promo is treated as exhausted and checkout is rejected with `promo_exhausted`. Old documents without `usageCount` default to `0`.

---

### `broadcasts`

This collection stores broadcast messages sent to Telegram subscribers.
Documents are written server-side by the Telegram bot webhook or Cloud Functions when a broadcast is sent.
The admin panel reads them to display broadcast history.

Document shape:

```ts
type BroadcastDocument = {
  createdAt: Timestamp
  createdBy: number
  sentCount: number
  failedCount: number
  reason: string
  text: string
}
```

Notes:
- Firestore document ID acts as the broadcast `id` in the app.
- `createdAt` is stored as a Firestore timestamp and may be `null` in transitional states.
- `createdBy` stores the Telegram user ID of the admin who triggered the broadcast.
- `sentCount` is the number of chats that successfully received the message.
- `failedCount` is the number of chats that failed to receive the message.
- `reason` contains the broadcast intent or trigger reason (e.g. `"new_drop"`).
- `text` is the broadcast message content sent to subscribers.
- Firestore security rules allow public reads (same as `products` and `promoCodes`), but client-side writes are denied — broadcasts are only created server-side.

---

## Supporting app types

These types are used by the app and explain how Firestore data is consumed.

### Product type

```ts
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
  isAvailable: boolean
  likesCount: number
  cartCount: number
  images: string[]
  createdAt: Timestamp | null
  isLimitedLabel?: string
}
```

### Cart item type

```ts
export type CartItem = {
  productId: Product['id']
  name: Product['name']
  price: Product['price']
  currency: Product['currency']
  image: string | null
}
```

### Checkout form type

```ts
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
```

### Broadcast type

```ts
export type Broadcast = {
  id: string
  createdAt: string | null
  createdBy: number | null
  sentCount: number
  failedCount: number
  reason: string
  text: string
}
```

---

### Promo types

```ts
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
  usageCount?: number
}

export type AppliedPromo = {
  code: PromoCode['code']
  discountType: PromoCode['discountType']
  discountValue: PromoCode['discountValue']
  discountAmount: number
}
```

### Order types

```ts
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
```

---

## Planned or optional collections

Keep these in mind if they exist already or are added later:
- `categories`
- `dropSubscriptions`
- `wishlists`
- `adminUsers` or equivalent admin-role mapping collection

These should only be documented in detail once their real implementation is confirmed from code.

---

## Additional collections

### `campaigns`

This collection stores marketing campaign/carousel entries managed by the admin panel.

Document shape:

```ts
type CampaignDocument = {
  tag: string
  headingPart1: string
  headingPart2: string
  subtitle: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}
```

Notes:
- Documents are ordered by `sortOrder` ascending.
- The admin `CarouselManagerPanel` and `CampaignAdminPanel` manage these entries.
- Public read, writes only via Cloud Functions.

---

### `giveaways`

This collection stores giveaway entries shown in the Rewards section.

Document shape:

```ts
type GiveawayDocument = {
  productId: string
  productName: string
  productImage: string
  totalTickets: number
  enteredCount: number
  endsAt: string | null
  isActive: boolean
  winnerUsername: string | null
  createdAt: string
  updatedAt: string
}
```

Notes:
- Public read, writes only via Cloud Functions.
- `totalTickets` is the number of tickets needed to enter.
- `enteredCount` tracks current entries.

---

### `tasks`

This collection stores reward tasks shown in the Rewards section.

Document shape:

```ts
type TaskDocument = {
  title: string
  rewardType: 'coupon' | 'ticket'
  rewardValue: string
  status: 'active' | 'inactive'
  sortOrder: number
  createdAt: string
  updatedAt: string
}
```

Notes:
- Public read, writes only via Cloud Functions.
- `rewardValue` depends on `rewardType` — a coupon code or ticket count string.

---

### `bannerSlides`

This collection stores hero carousel slides for the storefront.

Document shape:

```ts
type BannerSlideDocument = {
  imageUrl: string
  badgeText: string
  headline: string
  subheading: string
  caption: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}
```

Notes:
- Public read. Writes currently go through direct Firestore client access (not Cloud Functions).
- Ordered by `sortOrder` ascending.
- The `CarouselManagerPanel` manages these slides.

---

### `telegramSubscribers`

This collection stores Telegram users who have interacted with the bot (`/start` command).

Document shape:

```ts
type TelegramSubscriberDocument = {
  telegramUserId: number
  chatId: number
  username: string | null
  firstName: string | null
  isAdmin: boolean
  allowBroadcasts: boolean
  createdAt: Timestamp
  lastSeenAt: Timestamp
  referredBy?: string
}
```

Notes:
- Document ID is the stringified `telegramUserId`.
- Created/updated server-side by the `telegramBotWebhook` Cloud Function.
- Read and write access is denied from the client; only Functions can access.
- `allowBroadcasts` is used by the broadcast function to filter recipients.
- `referredBy` is an optional field for tracking referral sources.

---

## Security rules summary

The following table summarizes the Firestore security rules for each collection:

| Collection | Read | Write | Notes |
|---|---|---|---|
| `products` | Public | Denied | Writes handled by Cloud Functions |
| `promoCodes` | Public | Denied | Writes handled by Cloud Functions |
| `orders` | Denied | Denied | All access via Cloud Functions |
| `broadcasts` | Public | Denied | Writes handled server-side by Telegram bot |
| `campaigns` | Public | Denied | Writes handled by Cloud Functions |
| `giveaways` | Public | Denied | Writes handled by Cloud Functions |
| `tasks` | Public | Denied | Writes handled by Cloud Functions |
| `bannerSlides` | Public | Denied | Writes handled by Cloud Functions or direct Firestore |
| `polls` | Public | Denied | Writes handled by Cloud Functions |
| `pollVotes` | Denied | Denied | All access via Cloud Functions only |
| `telegramSubscribers` | Denied | Denied | All access via Cloud Functions only |
| `productNotifySubscriptions` | Denied | Denied | All access via Cloud Functions only |
| `userRewards` | Denied | Denied | All access via Cloud Functions only |

---

## Telegram data note

The app may read Telegram WebApp data on the client through `window.Telegram.WebApp`, including:
- `initData`
- `initDataUnsafe.user`
- theme values
- basic Telegram user profile fields

Relevant client-side shape:

```ts
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready(): void
        initData?: string
        colorScheme?: 'light' | 'dark'
        themeParams?: {
          bg_color?: string
          text_color?: string
          hint_color?: string
          link_color?: string
          button_color?: string
          button_text_color?: string
          secondary_bg_color?: string
        }
        initDataUnsafe?: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            language_code?: string
            is_premium?: boolean
          }
        }
      }
    }
  }
}

export {}
```

Important:
- `initDataUnsafe` is useful for client UX, but it is not enough by itself for trust-sensitive actions.
- If auth or identity verification depends on Telegram data, server-side verification rules should be documented separately in a security document.

---

## Example broadcast document

```json
{
  "createdAt": "Firestore Timestamp",
  "createdBy": 123456789,
  "sentCount": 142,
  "failedCount": 3,
  "reason": "new_drop",
  "text": "New drop is live! Check out the latest YungWear Heavyweight Hoodie."
}
```

---

## Example promo code document

```json
{
  "code": "DROP10",
  "discountType": "percentage",
  "discountValue": 10,
  "isActive": true,
  "expiresAt": null,
  "usageLimit": null,
  "usageCount": 0
}
```

## Example product document

```json
{
  "name": "YungWear Heavyweight Hoodie",
  "description": "Oversized streetwear hoodie with a heavyweight cotton feel.",
  "category": "hoodies",
  "brandNames": ["YungWear"],
  "price": 120,
  "currency": "EUR",
  "isAvailable": true,
  "likesCount": 0,
  "cartCount": 0,
  "images": [
    "https://firebasestorage.googleapis.com/..."
  ],
  "createdAt": "Firestore Timestamp",
  "isLimitedLabel": "Limited Drop"
}
```

## Example order document

```json
{
  "fullName": "Alex Example",
  "telegramHandle": "@alex",
  "telegramUserId": 123456789,
  "note": "Please message before meetup.",
  "fulfillmentType": "meetup",
  "paymentMethod": "meetup_cash",
  "deliveryCity": "",
  "deliveryAddress": "",
  "deliveryNotes": "",
  "meetupLocation": "Riga Center",
  "meetupTimeOption": "Evening",
  "meetupNotes": "After 18:00 works best",
  "items": [
    {
      "productId": "product_123",
      "name": "YungWear Heavyweight Hoodie",
      "price": 120,
      "currency": "EUR",
      "image": "https://firebasestorage.googleapis.com/..."
    }
  ],
  "subtotal": 120,
  "appliedPromo": {
    "code": "DROP10",
    "discountType": "percentage",
    "discountValue": 10,
    "discountAmount": 12
  },
  "total": 108,
  "status": "new",
  "cancelReason": "",
  "createdAt": "Firestore Timestamp"
}
```