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

#### Subcollection: `products/{productId}/signals/{telegramUserId}`

Stores each user's per-product popularity contribution so the shared counters can never be spammed.

```ts
type ProductSignalDocument = {
  likesCount: 0 | 1
  cartCount: 0 | 1
}
```

Notes:
- Document ID is the stringified Telegram user id — a user contributes **at most 1** per signal per product (cart de-dupes products client-side, so binary contribution matches product-line semantics).
- `updateProductSignal` reads the signal doc and the product counter in a single Firestore transaction; a repeated `+1` is a no-op (`already_applied`) and a `-1` with no contribution is a no-op (`not_applied`), so spamming can never inflate or drain `likesCount`/`cartCount`.
- Counters therefore reflect the number of *distinct users* currently liking / holding the product (plus any pre-fix legacy base value).
- Read and write access is denied from the client (firestore.rules); only Functions can access.

---

### `orders`

This collection stores checkout submissions written by the storefront.

Document shape:

```ts
type OrderDocument = {
  clientOrderId: string
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
- The Firestore document ID **is** the client-generated `clientOrderId` idempotency key (M4) and doubles as the order `id` in the app. Retries / double-taps map to the same document, so duplicate orders are impossible; the field is stored on the doc for auditability.
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
- The collection is **not client-readable** (L9): buyers validate codes through the `/api/promos/validate` Cloud Function (`validatePromoCode`), and admins list them through `/api/admin/listPromoCodes` (`listPromoCodesAdmin`). The checkout function (`createCheckoutOrder`) remains the authoritative validator.

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
- Firestore security rules allow public reads (same as `products`), but client-side writes are denied — broadcasts are only created server-side.

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

This collection stores giveaways (with prizes and entry tasks) shown in the Rewards section.

Document shape:

```ts
type GiveawayDocument = {
  title: string
  description: string
  imageUrl: string
  status: 'draft' | 'scheduled' | 'live' | 'finished' | 'announced'
  startAt: string | null
  endAt: string
  prizes: Array<{
    productId: string
    place: number
    productName: string
    productImage: string
  }>
  winnersCount: number
  accessLevel: 'public' | 'early_access_only'
  entryTasks: Array<{
    id: string
    type: 'join_channel' | 'invite_friend' | 'like_product' | 'custom'
    label: string
    ticketsGranted: number
    verifyMethod: 'telegram_api' | 'referral_count' | 'client_claim' | 'manual'
    metadata: string | null
  }>
  taskIds: string[]
  taskTickets: Record<string, number>
  baseEntryTickets: number
  prizesForSale: boolean
  enteredCount: number
  totalTicketsPool: number
  winners: Array<{
    place: number
    productId: string
    telegramUserId: number
    telegramUsername: string | null
    ticketsAtWinTime: number
  }> | null
  drawSeed: string | null
  drawMethod: 'seeded_weighted_ticket' | null
  drawAlgorithmVersion: number | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}
```

Notes:
- `prizesForSale` is an **admin toggle** (default `false`): when `true`, the storefront treats the prize products as normal sellable items again (e.g. the winner declined after the draw). The storefront's giveaway-prize lock skips giveaways with this flag set.
- Since 2026-08-09 (L2) the draw uses a **CSPRNG seed** (`drawSeed`, 256-bit hex from `crypto.randomBytes`) and a deterministic SHA-256-derived PRNG (`seeded_weighted_ticket`, `drawAlgorithmVersion: 1`) over entries sorted by doc id — so a finished giveaway's draw can be **re-verified** from the stored seed. Code generation (`generateShortId`, check-in `DAILY*` codes, referral `REF*` codes) also uses `crypto.randomInt`.

Player entries live in the subcollection `giveaways/{giveawayId}/entries`:

```ts
type GiveawayEntry = {
  telegramUserId: number
  telegramUsername: string | null
  joinedAt: string
  completedTaskIds: string[]
  totalTickets: number
}
```

Notes:
- Public read, writes only via Cloud Functions.
- Entry document ID is the **stringified `telegramUserId`** (since 2026-08-09, H5). `joinGiveaway` and `completeGiveawayTask` read that doc **inside** the checkout-style transaction, so concurrent joins/completions serialize on it and duplicate entries or double-granted task tickets are impossible.
- Legacy entries created before H5 used random document ids; both transactions still detect them via a `telegramUserId` fallback query so they are never duplicated or double-rewarded. Invariant: a user can never have both a legacy entry and a deterministic entry — the join path checks the deterministic doc first and falls back to the legacy query, so at most one entry per user exists.
- `status` gates all player actions (join/task/draw). Since 2026-08-09 (GW-5/GW-6) the join and task transactions also enforce `endAt` (a `live` giveaway past its end date rejects new entries and task completions with `giveaway_ended`) and `accessLevel: 'early_access_only'` (join requires ≥ 1 real referral, self-referrals excluded, else `access_restricted`).
- `getGiveawayEntries` returns a **privacy-scrubbed** leaderboard (L1, since 2026-08-09): each row contains only `telegramUsername`, `joinedAt`, `totalTickets` and a server-computed `isMe` — never `telegramUserId` or `completedTaskIds`. The requester's own full entry (including their own `telegramUserId` and `completedTaskIds`) is returned separately as `myEntry`.
- `entryTasks[].verifyMethod` is **enforced server-side** (since 2026-08-09, H6) before task tickets are granted: `manual` passes (honor-system); `referral_count` requires the user to have been referred (`referredBy` set) or — when `metadata` is a positive integer N — to have ≥ N real referrals (self-referrals excluded); `telegram_api` requires a bot `getChatMember` membership check on the chat id in `metadata` (missing chat id or API error fails closed); `client_claim` (like-product tasks, since 2026-08-09) compares the integer threshold in `metadata` (default 1) against the user's **server-tracked** like count in `userStats/{telegramUserId}.likedProductCount` (maintained transactionally by `updateProductSignal` on every like/unlike) — a missing `userStats` doc fails closed (count 0), so the device can never self-verify. The client still shows an instant device-local pre-check, but the server is authoritative.

---

### `tasks`

This collection stores reward tasks shown in the Rewards section.

Document shape:

```ts
type TaskDocument = {
  title: string
  status: 'active' | 'inactive'
  sortOrder: number
  actionUrl?: string
  taskType?: 'custom' | 'join_channel' | 'invite_friend' | 'like_product'
  requiredCount?: number
  createdAt: string
  updatedAt: string
}
```

Notes:
- Public read, writes only via Cloud Functions.
- Tasks are **giveaway-only** — the ticket count per task lives on the giveaway (`taskTickets`), not here. Legacy `rewardType`/`rewardValue`/`actionLabel` fields may still exist on old docs but are no longer written or read.
- When a task is attached to a giveaway, `taskType` (since 2026-08-09) decides how it is verified: `custom` (default) → `verifyMethod: 'manual'` with `actionUrl` as metadata; `join_channel` → `telegram_api` with `actionUrl` as the channel; `invite_friend` → `referral_count` with `requiredCount` as the threshold (or no threshold when unset — any real referral passes); `like_product` → `client_claim` with `requiredCount` as the required like count (default 1).
- Saving a task **propagates immediately** (since 2026-08-09): `upsertTaskAdmin` re-resolves the task inside every giveaway that references it (`taskIds` array-contains), so the buyer UI and enforcement update without re-saving the giveaway. Completion also re-resolves defensively as a fallback.

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
- `referredBy` is an optional field for tracking referral sources. Self-referrals (subscriber === referrer) are never stored (write-time guard) and are excluded from every referral count (early access, milestones, leaderboard, analytics) — H4 protection.

---

### `referralRewards`

This collection records which referral milestone promo codes have already been granted to a user, so a code is never issued twice.

Document shape:

```ts
type ReferralRewardsDocument = {
  [threshold: string]: {
    promoCode: string
    promoCodeId: string
    grantedAt: string
  }
}
```

Example for a user who reached the 3-referral milestone:

```json
{
  "3": {
    "promoCode": "REF05_1234_AB12",
    "promoCodeId": "promoDocId",
    "grantedAt": "2026-01-01T12:00:00.000Z"
  }
}
```

Notes:
- Document ID is the stringified `telegramUserId`.
- Each top-level key is the referral-count threshold (`3`, `5`, `10`, `15`) that was reached.
- Milestones grant one-time percentage promo codes (`5%`, `10%`, `15%`, `25%` OFF) written to `promoCodes` with a 30-day expiry and a usage limit of 1.
- Grants are created and the promo code written inside a single Firestore transaction by `processAndCheckRewards` (invoked by `getReferralInfo`), so concurrent calls can never double-grant.
- Read and write access is denied from the client; only Functions can access.

---

### `userStats`

This collection stores per-user server-tracked counters used for task verification.

Document shape:

```ts
type UserStatsDocument = {
  telegramUserId: number
  likedProductCount: number
  updatedAt: string
}
```

Notes:
- Document ID is the stringified `telegramUserId`.
- `likedProductCount` is incremented/decremented **inside the same transaction** as the per-user like signal in `products/{productId}/signals/{telegramUserId}` (by `updateProductSignal`), so dedupe is inherited: a repeated `+1` on the same product returns `already_applied` and never inflates the count, and `-1` without a contribution returns `not_applied`. The count is clamped at 0.
- Read and write access is denied from the client; only Functions can access.
- Used by giveaway `client_claim` tasks ("like N products") as the authoritative server-side count.

---

### `userSettings`

This collection stores per-user privacy preferences.

Document shape:

```ts
type UserSettingsDocument = {
  telegramUserId: number
  leaderboardShown: boolean
  allowBroadcasts: boolean
  updatedAt: string
}
```

Notes:
- Document ID is the stringified `telegramUserId`.
- Created/updated by the `updateUserSettingsHandler` Cloud Function (from Preferences: broadcast subscription and leaderboard visibility).
- `leaderboardShown` defaults to `true` when the document or field is missing — only an explicit `false` hides a user from the referral leaderboard.
- `getReferralLeaderboard` filters out referrers with `leaderboardShown === false`, so users who opted out never appear in the public leaderboard or in rank computation.
- Read and write access is denied from the client; only Functions can access.

---

### `presence`

This collection powers the realtime online-user counter shown in the app shell.

Document shape:

```ts
type PresenceDocument = {
  lastSeen: Timestamp
}
```

Notes:
- Document ID is the stringified `telegramUserId`.
- Written only by the `updatePresence` Cloud Function (server-verified heartbeat, every 60s per active user); the client can **read** the collection (to count active users) but never writes it — `firestore.rules` deny all client writes, so the counter can never be inflated with fake docs (M6).
- Docs are never deleted; a user counts as online when `lastSeen` is within the 5-minute active window (readers filter client-side).

---

## Security rules summary

The following table summarizes the Firestore security rules for each collection:

| Collection | Read | Write | Notes |
|---|---|---|---|
| `products` | Public | Denied | Writes handled by Cloud Functions |
| `promoCodes` | Denied | Denied | All access via Cloud Functions only |
| `orders` | Denied | Denied | All access via Cloud Functions |
| `broadcasts` | Public | Denied | Writes handled server-side by Telegram bot |
| `campaigns` | Public | Denied | Writes handled by Cloud Functions |
| `giveaways` | Public | Denied | Writes handled by Cloud Functions |
| `tasks` | Public | Denied | Writes handled by Cloud Functions |
| `bannerSlides` | Public | Denied | Writes handled by Cloud Functions or direct Firestore |
| `telegramSubscribers` | Denied | Denied | All access via Cloud Functions only |
| `referralRewards` | Denied | Denied | All access via Cloud Functions only |
| `userStats` | Denied | Denied | All access via Cloud Functions only |
| `userSettings` | Denied | Denied | All access via Cloud Functions only |
| `userRewards` | Denied | Denied | All access via Cloud Functions only |
| `presence` | Public | Denied | Reads public (online counter); writes only via Cloud Functions (server-verified heartbeat) |

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