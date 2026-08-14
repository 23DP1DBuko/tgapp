// ── Shared imports, constants, and helper functions ──
// Auto-generated from index.ts refactoring

import crypto from 'node:crypto'

import { getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { onRequest } from 'firebase-functions/v2/https'
import { defineInt, defineSecret, defineString } from 'firebase-functions/params'

// Type-only imports for validation functions (avoids circular runtime deps)
import type { ApiOrder, CheckoutCartItem, CheckoutAppliedPromo, CreateCheckoutOrderRequest } from './orders.js'
import type { PromoAdminInput, UploadProductImageAdminRequest } from './promoCodes.js'
import type { ProductAdminInput } from './products.js'
import type { GiveawayAdminInput } from './giveaways.js'
import type { CampaignAdminInput, TaskAdminInput, AdminAnalyticsRequest, AdminAnalyticsResponse } from './content.js'
// Upload banner types (used by uploadBannerImageAdmin)
type UploadBannerImageAdminRequest = {
  initData: string
  fileName: string
  contentType: string
  base64Data: string
}
type UploadBannerImageAdminResponse = {
  ok: boolean
  imageUrl: string | null
  storagePath: string | null
  detail?: string
  reason:
    | 'uploaded'
    | 'invalid_method'
    | 'invalid_payload'
    | 'invalid_init_data'
    | 'expired_init_data'
    | 'missing_bot_token'
    | 'forbidden'
    | 'internal_error'
}


// ── Constants ──

export const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 60 * 60
export const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')
export const telegramAdminIds = defineString('TELEGRAM_ADMIN_IDS')
export const telegramInitDataMaxAgeSeconds = defineInt('TELEGRAM_INIT_DATA_MAX_AGE_SECONDS')
export const telegramMiniAppUrl = defineString('TELEGRAM_MINI_APP_URL')
export const telegramWebhookSecret = defineSecret('TELEGRAM_WEBHOOK_SECRET')
export const ORDER_STATUSES = [
  'new',
  'waiting_for_payment',
  'paid',
  'ready_for_meetup',
  'completed',
  'cancelled',
] as const
export const PROMO_DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const
export const PRODUCT_CATEGORIES = [
  'hoodies',
  'tshirts',
  'outerwear',
  'accessories',
  'other',
] as const
export const PRODUCT_DISCOUNT_TYPES = ['percentage', 'fixed'] as const

if (getApps().length === 0) {
  initializeApp()
}

// ── Type helpers (imported by modules) ──

export type TelegramInitDataUser = {
  id?: number
  [key: string]: unknown
}

export type RewardTier = {
  threshold: number
  discountPercent: number
  codeSuffix: string
  label: string
}

export type TelegramWebhookRequest = {
  message?: {
    chat?: {
      id?: number
      type?: string
    }
    from?: {
      id?: number
      username?: string
      first_name?: string
    }
    text?: string
  }
}

// ── Helper functions ──

export function toApiOrder(orderId: string, rawData: Record<string, unknown>): ApiOrder {
  const data = rawData as Partial<ApiOrder>
  return {
    id: orderId,
    fullName: data.fullName ?? '',
    telegramHandle: data.telegramHandle ?? '',
    telegramUserId: data.telegramUserId ?? null,
    note: data.note ?? '',
    fulfillmentType: data.fulfillmentType ?? 'delivery',
    paymentMethod: data.paymentMethod ?? 'meetup_cash',
    deliveryCity: data.deliveryCity ?? '',
    deliveryAddress: data.deliveryAddress ?? '',
    deliveryNotes: data.deliveryNotes ?? '',
    meetupLocation: data.meetupLocation ?? '',
    meetupTimeOption: data.meetupTimeOption ?? '',
    meetupNotes: data.meetupNotes ?? '',
    items: data.items ?? [],
    subtotal: data.subtotal ?? 0,
    appliedPromo: data.appliedPromo ?? null,
    total: data.total ?? 0,
    status: data.status ?? 'new',
    cancelReason: data.cancelReason ?? '',
    createdAt: typeof data.createdAt === 'object' && data.createdAt !== null && 'toDate' in data.createdAt
      ? (data.createdAt as { toDate(): Date }).toDate().toISOString()
      : typeof data.createdAt === 'string'
        ? data.createdAt
        : null,
  }
}

export function readAdminIdsFromEnv(): number[] {
  const rawValue = telegramAdminIds.value() ?? ''

  return rawValue
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
}

export function isOrderStatus(value: unknown): value is (typeof ORDER_STATUSES)[number] {
  return typeof value === 'string' && ORDER_STATUSES.includes(value as (typeof ORDER_STATUSES)[number])
}

export function isPromoDiscountType(
  value: unknown,
): value is (typeof PROMO_DISCOUNT_TYPES)[number] {
  return (
    typeof value === 'string' &&
    PROMO_DISCOUNT_TYPES.includes(value as (typeof PROMO_DISCOUNT_TYPES)[number])
  )
}

export function isValidPromoInput(value: unknown): value is PromoAdminInput {
  if (!value || typeof value !== 'object') {
    return false
  }

  const promo = value as Partial<PromoAdminInput>

  return (
    typeof promo.code === 'string' &&
    promo.code.trim().length > 0 &&
    promo.code.trim().length <= 40 &&
    isPromoDiscountType(promo.discountType) &&
    typeof promo.discountValue === 'number' &&
    Number.isFinite(promo.discountValue) &&
    promo.discountValue > 0 &&
    promo.discountValue <= 100000 &&
    typeof promo.isActive === 'boolean' &&
    (promo.expiresAt === null || typeof promo.expiresAt === 'string') &&
    (promo.usageLimit === null ||
      (typeof promo.usageLimit === 'number' &&
        Number.isInteger(promo.usageLimit) &&
        promo.usageLimit >= 0)) &&
    (promo.usageCount === undefined ||
      promo.usageCount === null ||
      (typeof promo.usageCount === 'number' &&
        Number.isInteger(promo.usageCount) &&
        promo.usageCount >= 0))
  )
}

export function isProductDiscountType(value: unknown): value is (typeof PRODUCT_DISCOUNT_TYPES)[number] {
  return (
    typeof value === 'string' &&
    (PRODUCT_DISCOUNT_TYPES as readonly string[]).includes(value)
  )
}

/**
 * Compute the effective (discounted) price a buyer pays.
 *
 * Mirrors `getProductEffectivePrice` in src/lib/productPrice.ts — checkout
 * validates the client-submitted item prices against this exact math, so a
 * tampered price can never get through.
 *
 * - `percentage` → price reduced by N% (clamped at 0, never negative)
 * - `fixed`     → price reduced by N EUR (clamped at 0, never negative)
 * - anything else → the base price, unchanged
 */
export function applyProductDiscount(
  price: number,
  discountType: unknown,
  discountValue: unknown,
): number {
  if (discountType === 'percentage' && typeof discountValue === 'number' && discountValue > 0) {
    return Math.max(0, Math.round(price * (100 - Math.min(discountValue, 100))) / 100)
  }
  if (discountType === 'fixed' && typeof discountValue === 'number' && discountValue > 0) {
    return Math.max(0, Math.round((price - discountValue) * 100) / 100)
  }
  return price
}

/**
 * Validate the discount payload of the setProductDiscount admin endpoint.
 * `discountType: null` clears the discount. A fixed discount's value is checked
 * against the actual product price inside the endpoint (must be < price).
 */
export function isValidProductDiscountInput(
  value: unknown,
): value is { discountType: (typeof PRODUCT_DISCOUNT_TYPES)[number] | null; discountValue: number | null } {
  if (!value || typeof value !== 'object') {
    return false
  }

  const discount = value as { discountType?: unknown; discountValue?: unknown }

  if (discount.discountType === null) {
    return discount.discountValue === null || discount.discountValue === undefined
  }

  if (!isProductDiscountType(discount.discountType)) {
    return false
  }

  if (
    typeof discount.discountValue !== 'number' ||
    !Number.isFinite(discount.discountValue) ||
    discount.discountValue <= 0
  ) {
    return false
  }

  if (discount.discountType === 'percentage' && discount.discountValue > 100) {
    return false
  }

  return true
}

export function isValidProductInput(value: unknown): value is ProductAdminInput {
  if (!value || typeof value !== 'object') {
    return false
  }

  const product = value as Partial<ProductAdminInput>

  return (
    typeof product.name === 'string' &&
    product.name.trim().length > 0 &&
    product.name.trim().length <= 120 &&
    typeof product.description === 'string' &&
    product.description.trim().length > 0 &&
    product.description.trim().length <= 2000 &&
    typeof product.category === 'string' &&
    PRODUCT_CATEGORIES.includes(product.category as (typeof PRODUCT_CATEGORIES)[number]) &&
    Array.isArray(product.brandNames) &&
    product.brandNames.length <= 10 &&
    product.brandNames.every((brand) => typeof brand === 'string' && brand.trim().length > 0 && brand.trim().length <= 60) &&
    typeof product.price === 'number' &&
    Number.isFinite(product.price) &&
    product.price >= 0 &&
    product.price <= 100000 &&
    typeof product.isAvailable === 'boolean' &&
    Array.isArray(product.images) &&
    product.images.length <= 8 &&
    product.images.every((image) => typeof image === 'string' && image.length > 0 && image.length <= 2000) &&
    (product.isLimitedLabel === undefined ||
      (typeof product.isLimitedLabel === 'string' && product.isLimitedLabel.length <= 80)) &&
    (product.upcoming === undefined || typeof product.upcoming === 'boolean') &&
    (product.earlyAccessAt === undefined || product.earlyAccessAt === null || typeof product.earlyAccessAt === 'string') &&
    (product.publicAt === undefined || product.publicAt === null || typeof product.publicAt === 'string') &&
    (product.discountType === undefined ||
      product.discountType === null ||
      isProductDiscountType(product.discountType)) &&
    (product.discountValue === undefined ||
      product.discountValue === null ||
      (typeof product.discountValue === 'number' &&
        Number.isFinite(product.discountValue) &&
        product.discountValue >= 0 &&
        product.discountValue <= 100000 &&
        // A percentage discount can never exceed 100%.
        (product.discountType !== 'percentage' || product.discountValue <= 100)))
  )
}

export function isValidCheckoutCartItem(value: unknown): value is CheckoutCartItem {
  if (!value || typeof value !== 'object') {
    return false
  }

  const item = value as Partial<CheckoutCartItem>

  return (
    typeof item.productId === 'string' &&
    item.productId.trim().length > 0 &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    item.name.length <= 120 &&
    typeof item.price === 'number' &&
    Number.isFinite(item.price) &&
    item.price >= 0 &&
    item.price <= 100000 &&
    item.currency === 'EUR' &&
    (item.image === null || typeof item.image === 'string')
  )
}

export function isValidAppliedPromo(value: unknown): value is CheckoutAppliedPromo | null {
  if (value === null) {
    return true
  }

  if (!value || typeof value !== 'object') {
    return false
  }

  const promo = value as Partial<CheckoutAppliedPromo>

  return (
    typeof promo.code === 'string' &&
    promo.code.trim().length > 0 &&
    promo.code.length <= 40 &&
    isPromoDiscountType(promo.discountType) &&
    typeof promo.discountValue === 'number' &&
    Number.isFinite(promo.discountValue) &&
    typeof promo.discountAmount === 'number' &&
    Number.isFinite(promo.discountAmount) &&
    promo.discountAmount >= 0
  )
}

/**
 * Idempotency key for checkout submissions (M4). Used as the deterministic
 * order document ID, so a retry / double-tap maps to the same document and can
 * never create a duplicate order. UUID v4 (36 chars, hex + dashes) passes.
 */
export function isValidClientOrderId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(value)
}

export function isValidCheckoutOrderPayload(value: unknown): value is CreateCheckoutOrderRequest {
  if (!value || typeof value !== 'object') {
    return false
  }

  const order = value as Partial<CreateCheckoutOrderRequest>

  return (
    typeof order.initData === 'string' &&
    order.initData.trim().length > 0 &&
    isValidClientOrderId(order.clientOrderId) &&
    typeof order.fullName === 'string' &&
    order.fullName.trim().length > 0 &&
    order.fullName.length <= 120 &&
    typeof order.telegramHandle === 'string' &&
    order.telegramHandle.trim().length > 0 &&
    order.telegramHandle.length <= 80 &&
    // `status` and `telegramUserId` are validated for shape but ignored at order
    // creation — createCheckoutOrder derives both server-side (initial status
    // from paymentMethod; owner from the HMAC-verified user). Keep for client
    // compatibility; safe to remove from the API in a future cleanup.
    (order.telegramUserId === undefined ||
      order.telegramUserId === null ||
      Number.isInteger(order.telegramUserId)) &&
    typeof order.note === 'string' &&
    order.note.length <= 1000 &&
    (order.fulfillmentType === 'delivery' || order.fulfillmentType === 'meetup') &&
    (order.paymentMethod === 'meetup_cash' || order.paymentMethod === 'usdt') &&
    typeof order.deliveryCity === 'string' &&
    order.deliveryCity.length <= 120 &&
    typeof order.deliveryAddress === 'string' &&
    order.deliveryAddress.length <= 240 &&
    typeof order.deliveryNotes === 'string' &&
    order.deliveryNotes.length <= 1000 &&
    typeof order.meetupLocation === 'string' &&
    order.meetupLocation.length <= 80 &&
    typeof order.meetupTimeOption === 'string' &&
    order.meetupTimeOption.length <= 80 &&
    typeof order.meetupNotes === 'string' &&
    order.meetupNotes.length <= 1000 &&
    Array.isArray(order.items) &&
    order.items.length > 0 &&
    order.items.length <= 12 &&
    order.items.every((item) => isValidCheckoutCartItem(item)) &&
    typeof order.subtotal === 'number' &&
    Number.isFinite(order.subtotal) &&
    order.subtotal >= 0 &&
    isValidAppliedPromo(order.appliedPromo) &&
    typeof order.total === 'number' &&
    Number.isFinite(order.total) &&
    order.total >= 0 &&
    isOrderStatus(order.status) &&
    typeof order.cancelReason === 'string' &&
    order.cancelReason.length <= 500
  )
}

export function isProductSignal(value: unknown): value is 'likesCount' | 'cartCount' {
  return value === 'likesCount' || value === 'cartCount'
}

export function isSignalDelta(value: unknown): value is 1 | -1 {
  return value === 1 || value === -1
}

const VALID_ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  'new': ['ready_for_meetup', 'completed', 'cancelled'],
  'waiting_for_payment': ['paid', 'cancelled'],
  'paid': ['ready_for_meetup', 'completed', 'cancelled'],
  'ready_for_meetup': ['completed', 'cancelled'],
  'completed': [],
  'cancelled': [],
}

export function isValidOrderTransition(
  currentStatus: string,
  nextStatus: string,
): boolean {
  const allowed = VALID_ORDER_TRANSITIONS[currentStatus]
  if (!allowed) return false
  return allowed.includes(nextStatus)
}

export function isValidCampaignInput(value: unknown): value is CampaignAdminInput {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<CampaignAdminInput>
  return (
    typeof c.tag === 'string' && c.tag.trim().length > 0 && c.tag.trim().length <= 80 &&
    typeof c.headingPart1 === 'string' && c.headingPart1.trim().length > 0 && c.headingPart1.trim().length <= 120 &&
    typeof c.headingPart2 === 'string' && c.headingPart2.trim().length <= 120 &&
    typeof c.subtitle === 'string' && c.subtitle.trim().length <= 240 &&
    typeof c.imageUrl === 'string' && c.imageUrl.trim().length <= 2000 &&
    typeof c.isActive === 'boolean' &&
    typeof c.sortOrder === 'number' && Number.isFinite(c.sortOrder) && c.sortOrder >= 0
  )
}

export function isValidTaskInput(value: unknown): value is TaskAdminInput {
  if (!value || typeof value !== 'object') return false
  const t = value as Partial<TaskAdminInput>
  return (
    typeof t.title === 'string' && t.title.trim().length > 0 && t.title.trim().length <= 120 &&
    (t.status === 'active' || t.status === 'inactive') &&
    typeof t.sortOrder === 'number' && Number.isFinite(t.sortOrder) && t.sortOrder >= 0 &&
    (t.actionUrl === undefined || (typeof t.actionUrl === 'string' && t.actionUrl.length <= 500)) &&
    (t.taskType === undefined || ['custom', 'join_channel', 'invite_friend', 'like_product'].includes(t.taskType)) &&
    (t.requiredCount === undefined || (Number.isInteger(t.requiredCount) && t.requiredCount >= 1 && t.requiredCount <= 1000))
  )
}


export function isValidGiveawayInput(value: unknown): value is GiveawayAdminInput {
  if (!value || typeof value !== 'object') return false
  const g = value as Partial<GiveawayAdminInput>
  return (
    typeof g.title === 'string' && g.title.trim().length > 0 && g.title.trim().length <= 200 &&
    typeof g.description === 'string' && g.description.length <= 2000 &&
    (g.imageUrl === undefined || typeof g.imageUrl === 'string') && typeof g.status === 'string' && ['draft','scheduled','live','finished','announced'].includes(g.status) &&
    
    
    (g.startAt === null || typeof g.startAt === 'string') &&
    typeof g.endAt === 'string' && g.endAt.length > 0 &&
    Array.isArray(g.prizes) && g.prizes.length >= 1 && (g.accessLevel === 'public' || g.accessLevel === 'early_access_only') && Array.isArray(g.entryTasks) && typeof g.baseEntryTickets === 'number' && Number.isInteger(g.baseEntryTickets) && g.baseEntryTickets >= 0 && g.baseEntryTickets <= 1000 &&
    (g.prizesForSale === undefined || typeof g.prizesForSale === 'boolean')
  )
}

export function isValidGiveawayStatus(value: unknown): value is string {
  return typeof value === 'string' && ['draft', 'scheduled', 'live', 'finished', 'announced'].includes(value)
}

export function isValidGiveawayPrize(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false
  const p = value as Record<string, unknown>
  return typeof p.productId === "string" && p.productId.trim().length > 0 && p.productId.length <= 120 && typeof p.place === "number" && Number.isInteger(p.place) && p.place >= 1
}

export function isValidEntryTaskInput(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false
  const t = value as Record<string, unknown>
  return typeof t.type === "string" && ["join_channel", "invite_friend", "like_product", "custom"].includes(t.type) && typeof t.label === "string" && t.label.trim().length > 0 && t.label.length <= 200 && typeof t.ticketsGranted === "number" && Number.isInteger(t.ticketsGranted) && t.ticketsGranted >= 1 && t.ticketsGranted <= 100 && typeof t.verifyMethod === "string" && ["telegram_api", "referral_count", "client_claim", "manual"].includes(t.verifyMethod) && (t.metadata === undefined || t.metadata === null || (typeof t.metadata === "string" && (t.metadata as string).length <= 200))
}

/** Uniform random pick from a charset via CSPRNG (L2 — no Math.random). */
function randomCodeFromCharset(charset: string, length: number): string {
  let result = ""
  for (let i = 0; i < length; i++) {
    result += charset.charAt(crypto.randomInt(charset.length))
  }
  return result
}

/** 8-char lowercase-alphanumeric id (e.g. giveaway entry-task ids). */
export function generateShortId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  return randomCodeFromCharset(chars, 8)
}

/** 4-char uppercase-alphanumeric suffix for generated promo codes. */
export function generateRandomSuffix(length = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  return randomCodeFromCharset(chars, length)
}

export function isValidUploadImagePayload(
  value: Partial<Omit<UploadProductImageAdminRequest, 'initData'>>,
): value is Omit<UploadProductImageAdminRequest, 'initData'> {
  return (
    typeof value.fileName === 'string' &&
    value.fileName.trim().length > 0 &&
    value.fileName.trim().length <= 240 &&
    typeof value.contentType === 'string' &&
    value.contentType.startsWith('image/') &&
    value.contentType.length <= 120 &&
    typeof value.base64Data === 'string' &&
    value.base64Data.length > 0
  )
}

export function sanitizeStorageFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase()
}

export function buildFirebaseDownloadUrl(bucketName: string, storagePath: string, downloadToken: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`
}

export function parseStoragePathFromImageUrl(imageUrl: string, bucketName: string): string | null {
  if (imageUrl.startsWith(`gs://${bucketName}/`)) {
    return imageUrl.replace(`gs://${bucketName}/`, '')
  }

  try {
    const parsedUrl = new URL(imageUrl)

    if (
      parsedUrl.hostname.includes('firebasestorage.googleapis.com') &&
      parsedUrl.pathname.startsWith(`/v0/b/${bucketName}/o/`)
    ) {
      return decodeURIComponent(parsedUrl.pathname.replace(`/v0/b/${bucketName}/o/`, ''))
    }

    if (parsedUrl.hostname === 'storage.googleapis.com') {
      const normalizedPath = parsedUrl.pathname.replace(/^\/+/, '')

      if (normalizedPath.startsWith(`${bucketName}/`)) {
        return decodeURIComponent(normalizedPath.replace(`${bucketName}/`, ''))
      }
    }
  } catch {
    return null
  }

  return null
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
): {
  reason: 'ok' | 'invalid_init_data' | 'expired_init_data'
  user: TelegramInitDataUser | null
} {
  if (!initData) {
    return { reason: 'invalid_init_data', user: null }
  }

  const parsed = new URLSearchParams(initData)
  const providedHash = parsed.get('hash')

  if (!providedHash) {
    return { reason: 'invalid_init_data', user: null }
  }

  const dataCheckString = Array.from(parsed.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (
    computedHash.length !== providedHash.length ||
    !crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(providedHash))
  ) {
    return { reason: 'invalid_init_data', user: null }
  }

  const authDate = Number(parsed.get('auth_date'))

  if (!Number.isFinite(authDate)) {
    return { reason: 'invalid_init_data', user: null }
  }

  const maxAgeSeconds = readInitDataMaxAgeSeconds()
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (nowSeconds - authDate > maxAgeSeconds) {
    return { reason: 'expired_init_data', user: null }
  }

  const rawUser = parsed.get('user')

  if (!rawUser) {
    return { reason: 'invalid_init_data', user: null }
  }

  try {
    return {
      reason: 'ok',
      user: JSON.parse(rawUser) as TelegramInitDataUser,
    }
  } catch {
    return { reason: 'invalid_init_data', user: null }
  }
}

export function readInitDataMaxAgeSeconds(): number {
  const rawValue = telegramInitDataMaxAgeSeconds.value()

  if (Number.isInteger(rawValue) && rawValue > 0) {
    return rawValue
  }

  return DEFAULT_INIT_DATA_MAX_AGE_SECONDS
}

export async function sendTelegramOrderCancelledMessage(
  botToken: string,
  telegramUserId: number,
  orderId: string,
  cancelReason: string,
) {
  const lines = [
    `Order ${orderId} is cancelled.`,
    cancelReason ? `Reason: ${cancelReason}` : 'Reason: not provided.',
    'If you want help or a different piece, reply here in Telegram.',
  ]

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text: lines.join('\n'),
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

export async function sendTelegramOrderPaidMessage(
  botToken: string,
  telegramUserId: number,
  orderId: string,
) {
  const lines = [
    `Order ${orderId} is locked in.`,
    'Payment was confirmed and your piece is moving to the next step.',
    'We will message you here when meetup or delivery is ready.',
  ]

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text: lines.join('\n'),
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

export async function sendTelegramOrderCompletedMessage(
  botToken: string,
  telegramUserId: number,
  orderId: string,
) {
  const lines = [
    `Order ${orderId} is complete.`,
    'Thanks for grabbing a piece from the drop.',
    'Stay close to the bot if you want first access to the next release.',
  ]

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text: lines.join('\n'),
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

export async function sendTelegramOrderReadyForMeetupMessage(
  botToken: string,
  telegramUserId: number,
  orderId: string,
) {
  const lines = [
    `Order ${orderId} is meetup-ready.`,
    'Your piece is packed and ready for handoff.',
    'Watch this chat for the final place and time confirmation.',
  ]

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text: lines.join('\n'),
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

export type OrderCreatedMessageInput = {
  orderId: string
  itemsSummary: string
  total: number
  fulfillmentLabel: string
  statusLabel: string
  miniAppUrl: string | null
}

/**
 * Builds the order-confirmed Telegram message text. Extracted as a pure
 * function so the formatting (real newlines, not the literal "\n" sequence)
 * is covered by unit tests (M1).
 */
export function buildOrderCreatedMessageText(input: OrderCreatedMessageInput): string {
  const lines = [
    '✅ Order Confirmed',
    '',
    `Order: ${input.orderId}`,
    `Items: ${input.itemsSummary}`,
    `Total: ${input.total} EUR`,
    `Fulfillment: ${input.fulfillmentLabel}`,
    `Status: ${input.statusLabel}`,
  ]

  if (input.miniAppUrl) {
    lines.push('', `Track it: ${input.miniAppUrl}`)
  }

  lines.push('', 'We will message you here when the status changes.')

  return lines.join('\n')
}

export async function sendTelegramOrderCreatedMessage(
  botToken: string,
  miniAppUrl: string | null,
  telegramUserId: number,
  orderId: string,
  itemsSummary: string,
  total: number,
  fulfillmentType: string,
  status: string,
) {
  const statusLabel =
    status === 'waiting_for_payment' ? 'Waiting for Payment' : 'New'
  const fulfillmentLabel =
    fulfillmentType === 'delivery' ? 'Delivery' : 'Meetup'

  const text = buildOrderCreatedMessageText({
    orderId,
    itemsSummary,
    total,
    fulfillmentLabel,
    statusLabel,
    miniAppUrl,
  })

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text,
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

export function isStartCommand(messageText: string) {
  const normalizedText = messageText.toLowerCase()

  return normalizedText === '/start' || normalizedText.startsWith('/start ')
}

export function isStoreCommand(messageText: string) {
  const normalizedText = messageText.toLowerCase()

  return normalizedText === '/store'
}

export function isHelpCommand(messageText: string) {
  const normalizedText = messageText.toLowerCase()

  return normalizedText === '/help'
}

// ── Reward-code bot messages (L5) ──
// Milestone promo codes (check-in / referral) are delivered by bot DM too, so
// the user has a persistent copy. Sending is fail-open at every call site.

export function buildRewardMessageText(input: {
  headline: string
  label: string
  code: string
}): string {
  const lines = [
    input.headline,
    '',
    `You unlocked a ${input.label} promo code:`,
    `Code: ${input.code}`,
    '',
    'Single use · Valid for 30 days · Enter it at checkout.',
  ]
  return lines.join('\n')
}

export async function sendTelegramRewardMessage(
  botToken: string,
  telegramUserId: number,
  input: { headline: string; label: string; code: string },
): Promise<void> {
  const text = buildRewardMessageText(input)

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text,
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

/**
 * Which referral milestones already have a code on disk. Used to DM only
 * NEWLY granted codes (L5): the Rewards screen calls getReferralInfo on every
 * visit, and re-visiting must never re-send a code.
 */
export async function readGrantedRewardThresholds(
  db: FirebaseFirestore.Firestore,
  telegramUserId: number,
): Promise<Set<number>> {
  const rewardsSnapshot = await db
    .collection('referralRewards')
    .doc(String(telegramUserId))
    .get()

  const granted = new Set<number>()
  if (!rewardsSnapshot.exists) return granted

  const grants = rewardsSnapshot.data() as Record<string, unknown> | undefined
  if (!grants) return granted

  for (const [key, value] of Object.entries(grants)) {
    const threshold = Number(key)
    const promoCode = (value as { promoCode?: unknown } | undefined)?.promoCode
    if (Number.isInteger(threshold) && typeof promoCode === 'string' && promoCode.length > 0) {
      granted.add(threshold)
    }
  }
  return granted
}

export async function sendTelegramStoreWelcomeMessage(
  botToken: string,
  chatId: number,
  firstName?: string,
) {
  const miniAppUrl = telegramMiniAppUrl.value()

  if (!miniAppUrl) {
    throw new Error('TELEGRAM_MINI_APP_URL is not configured.')
  }

  const greetingLine = firstName ? `Yo ${firstName}, the drop is live.` : 'Yo, the drop is live.'
  const text = [
    greetingLine,
    'Open the store to browse the current pieces, save favorites, and send a real order request inside Telegram.',
  ].join('\n\n')

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Open Store',
              web_app: {
                url: miniAppUrl,
              },
            },
          ],
          [
            {
              text: 'Store Link',
              url: miniAppUrl,
            },
          ],
        ],
      },
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

export async function sendTelegramStoreShortcutMessage(
  botToken: string,
  chatId: number,
) {
  const miniAppUrl = telegramMiniAppUrl.value()

  if (!miniAppUrl) {
    throw new Error('TELEGRAM_MINI_APP_URL is not configured.')
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: 'Store is here. Open the Mini App and move fast if a piece is getting attention.',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Open Store',
              web_app: {
                url: miniAppUrl,
              },
            },
          ],
        ],
      },
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

export async function sendTelegramHelpMessage(
  botToken: string,
  chatId: number,
) {
  const lines = [
    'Commands',
    '/start - get the welcome message and open-store button',
    '/store - open the store entry message again',
    '/help - show this help text',
    '',
    'Tip: use the Open Store button for the cleanest Mini App flow.',
  ]

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join('\n'),
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

export async function sendTelegramBroadcastMessage(
  botToken: string,
  chatId: number,
  text: string,
) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(`Telegram sendMessage failed: ${response.status} ${bodyText}`)
  }
}

export async function upsertTelegramSubscriberFromUpdate(
  body: TelegramWebhookRequest | undefined,
  referralCode?: string | null,
) {
  const message = body?.message
  const from = message?.from
  const chat = message?.chat

  const telegramUserId = typeof from?.id === 'number' ? from.id : null
  const chatId = typeof chat?.id === 'number' ? chat.id : null
  const username = typeof from?.username === 'string' ? from.username : null
  const firstName = typeof from?.first_name === 'string' ? from.first_name : null

  if (!telegramUserId || !chatId) {
    return
  }

  const db = getFirestore()
  const docRef = db.collection('telegramSubscribers').doc(String(telegramUserId))

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef)
    const now = FieldValue.serverTimestamp()

    if (!snapshot.exists) {
      const subscriberData: Record<string, unknown> = {
        telegramUserId,
        chatId,
        username,
        firstName,
        isAdmin: false,
        allowBroadcasts: true,
        createdAt: now,
        lastSeenAt: now,
      }

      // Only store referredBy on first visit, never overwrite. The write choke
      // point enforces the full invariant: only well-formed ref_<id> codes, and
      // never a user's own code (self-referral, H4), so a self-referral can
      // never count toward their own milestones or early-access threshold.
      if (
        referralCode &&
        extractReferralUserId(referralCode) !== null &&
        !isSelfReferralCode(referralCode, telegramUserId)
      ) {
        subscriberData.referredBy = referralCode
      }

      transaction.set(docRef, subscriberData)
    } else {
      transaction.set(
        docRef,
        {
          chatId,
          username,
          firstName,
          lastSeenAt: now,
        },
        { merge: true },
      )
    }
  })
}

export function parseReferralCode(messageText: string): string | null {
  // Expected format: /start ref_123456789
  const parts = messageText.split(' ')
  if (parts.length < 2) return null

  const potentialCode = parts[1].trim()

  // Only accept well-formed numeric referral codes (ref_<id>) — a garbage code
  // would otherwise be stored and counted as a bogus "referral".
  return extractReferralUserId(potentialCode) !== null ? potentialCode : null
}

/** Parses the user id out of a referral code like `ref_123456789`, or null. */
export function extractReferralUserId(code: string): number | null {
  if (!/^ref_\d{1,15}$/.test(code)) return null
  return Number(code.slice(4))
}

/** True when a referral code points back at the same Telegram user (H4). */
export function isSelfReferralCode(
  referralCode: string | null | undefined,
  telegramUserId: number,
): boolean {
  if (!referralCode) return false
  const referrerId = extractReferralUserId(referralCode)
  return referrerId !== null && referrerId === telegramUserId
}

/** True when a subscriber document is a self-referral (subscriber === referrer). */
export function isSelfReferralSubscriberDoc(data: {
  telegramUserId?: unknown
  referredBy?: unknown
}): boolean {
  const subscriberUserId = typeof data.telegramUserId === 'number' ? data.telegramUserId : null
  const code = typeof data.referredBy === 'string' ? data.referredBy : ''
  const referrerId = extractReferralUserId(code)

  return subscriberUserId !== null && referrerId !== null && subscriberUserId === referrerId
}

/**
 * Counts referral documents for a referrer's code, excluding self-referrals
 * (subscriber === referrer). Defense-in-depth (H4): even if a self-referral
 * document exists, it never counts toward milestones or early access.
 */
export async function countReferralsExcludingSelf(
  db: FirebaseFirestore.Firestore,
  referralCode: string,
): Promise<number> {
  const snapshot = await db
    .collection('telegramSubscribers')
    .where('referredBy', '==', referralCode)
    .get()

  let count = 0
  for (const doc of snapshot.docs) {
    const data = doc.data()
    // Every doc here matches referredBy === referralCode, so the shared
    // self-referral predicate (subscriber === referrer) is the single source
    // of truth — the two checks cannot drift.
    if (isSelfReferralSubscriberDoc(data)) continue
    count += 1
  }

  return count
}

export const uploadBannerImageAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'invalid_method',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'missing_bot_token',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    const body = request.body as Partial<UploadBannerImageAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : ''
    const contentType = typeof body?.contentType === 'string' ? body.contentType.trim() : ''
    const base64Data = typeof body?.base64Data === 'string' ? body.base64Data.trim() : ''

    if (!isValidUploadImagePayload({ fileName, contentType, base64Data })) {
      response.status(400).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'invalid_payload',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'forbidden',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    try {
      const safeName = sanitizeStorageFileName(fileName)
      const storagePath = `banners/${Date.now()}-${crypto.randomUUID()}-${safeName}`
      const downloadToken = crypto.randomUUID()
      const buffer = Buffer.from(base64Data, 'base64')

      if (buffer.byteLength === 0 || buffer.byteLength > 5 * 1024 * 1024) {
        response.status(400).json({
          ok: false,
          imageUrl: null,
          storagePath: null,
          reason: 'invalid_payload',
          detail: 'Image must be greater than 0 bytes and smaller than 5 MB.',
        } satisfies UploadBannerImageAdminResponse)
        return
      }

      const bucket = getStorage().bucket()
      const file = bucket.file(storagePath)

      await file.save(buffer, {
        metadata: {
          contentType,
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
          },
        },
      })

      response.status(200).json({
        ok: true,
        imageUrl: buildFirebaseDownloadUrl(bucket.name, storagePath, downloadToken),
        storagePath,
        reason: 'uploaded',
      } satisfies UploadBannerImageAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies UploadBannerImageAdminResponse)
    }
  },
)

export const uploadGiveawayImageAdmin = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'invalid_method',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'missing_bot_token',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    const body = request.body as Partial<UploadBannerImageAdminRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : ''
    const contentType = typeof body?.contentType === 'string' ? body.contentType.trim() : ''
    const base64Data = typeof body?.base64Data === 'string' ? body.base64Data.trim() : ''

    if (!isValidUploadImagePayload({ fileName, contentType, base64Data })) {
      response.status(400).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'invalid_payload',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'forbidden',
      } satisfies UploadBannerImageAdminResponse)
      return
    }

    try {
      const safeName = sanitizeStorageFileName(fileName)
      const storagePath = `giveaways/${Date.now()}-${crypto.randomUUID()}-${safeName}`
      const downloadToken = crypto.randomUUID()
      const buffer = Buffer.from(base64Data, 'base64')

      if (buffer.byteLength === 0 || buffer.byteLength > 5 * 1024 * 1024) {
        response.status(400).json({
          ok: false,
          imageUrl: null,
          storagePath: null,
          reason: 'invalid_payload',
          detail: 'Image must be greater than 0 bytes and smaller than 5 MB.',
        } satisfies UploadBannerImageAdminResponse)
        return
      }

      const bucket = getStorage().bucket()
      const file = bucket.file(storagePath)

      await file.save(buffer, {
        metadata: {
          contentType,
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
          },
        },
      })

      response.status(200).json({
        ok: true,
        imageUrl: buildFirebaseDownloadUrl(bucket.name, storagePath, downloadToken),
        storagePath,
        reason: 'uploaded',
      } satisfies UploadBannerImageAdminResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        imageUrl: null,
        storagePath: null,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies UploadBannerImageAdminResponse)
    }
  },
)

export const getAdminAnalytics = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [telegramBotToken],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        ok: false,
        totalUsers: 0,
        itemsSold: 0,
        grossRevenueEur: 0,
        referralCount: 0,
        reason: 'invalid_method',
      } satisfies AdminAnalyticsResponse)
      return
    }

    const botToken = telegramBotToken.value()

    if (!botToken) {
      response.status(500).json({
        ok: false,
        totalUsers: 0,
        itemsSold: 0,
        grossRevenueEur: 0,
        referralCount: 0,
        reason: 'missing_bot_token',
      } satisfies AdminAnalyticsResponse)
      return
    }

    const body = request.body as Partial<AdminAnalyticsRequest> | undefined
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const verificationResult = verifyTelegramInitData(initData, botToken)

    if (verificationResult.reason !== 'ok' || !verificationResult.user?.id) {
      response.status(401).json({
        ok: false,
        totalUsers: 0,
        itemsSold: 0,
        grossRevenueEur: 0,
        referralCount: 0,
        reason:
          verificationResult.reason === 'expired_init_data'
            ? 'expired_init_data'
            : 'invalid_init_data',
      } satisfies AdminAnalyticsResponse)
      return
    }

    if (!readAdminIdsFromEnv().includes(verificationResult.user.id)) {
      response.status(403).json({
        ok: false,
        totalUsers: 0,
        itemsSold: 0,
        grossRevenueEur: 0,
        referralCount: 0,
        reason: 'forbidden',
      } satisfies AdminAnalyticsResponse)
      return
    }

    try {
      const db = getFirestore()

      // Count all telegramSubscribers
      const subscribersSnapshot = await db.collection('telegramSubscribers').count().get()
      const totalUsers = subscribersSnapshot.data().count

      // Aggregate order data — all orders
      const ordersSnapshot = await db.collection('orders').get()
      let itemsSold = 0
      let grossRevenueEur = 0

      for (const doc of ordersSnapshot.docs) {
        const data = doc.data()

        // Count items in each order
        if (Array.isArray(data.items)) {
          itemsSold += data.items.length
        }

        // Sum total for completed/paid/ready_for_meetup orders
        const status = typeof data.status === 'string' ? data.status : ''
        if (status === 'completed' || status === 'paid' || status === 'ready_for_meetup') {
          const total = typeof data.total === 'number' ? data.total : 0
          grossRevenueEur += total
        }
      }

      // Count referrals (subscribers with a valid referredBy code), excluding
      // self-referrals (H4) so the metric can't be inflated by own-link taps.
      const referredSnapshot = await db
        .collection('telegramSubscribers')
        .where('referredBy', '>=', '')
        .get()
      let referralCount = 0
      for (const doc of referredSnapshot.docs) {
        const data = doc.data()
        const code = typeof data.referredBy === 'string' ? data.referredBy : ''
        if (extractReferralUserId(code) === null) continue
        if (isSelfReferralSubscriberDoc(data)) continue
        referralCount += 1
      }

      response.status(200).json({
        ok: true,
        totalUsers,
        itemsSold,
        grossRevenueEur: Math.round(grossRevenueEur * 100) / 100,
        referralCount,
        reason: 'listed',
      } satisfies AdminAnalyticsResponse)
    } catch (error) {
      response.status(500).json({
        ok: false,
        totalUsers: 0,
        itemsSold: 0,
        grossRevenueEur: 0,
        referralCount: 0,
        reason: 'internal_error',
        detail: error instanceof Error ? error.message : 'Unknown backend error.',
      } satisfies AdminAnalyticsResponse)
    }
  },
)
// ── Referral reward milestones ──
// Grant one-time promo codes as the user's referral count grows.
// Mirrors the check-in milestone ladder (5/10/15/25% OFF).

const REFERRAL_MILESTONES: RewardTier[] = [
  { threshold: 3, discountPercent: 5, codeSuffix: '05', label: '5% OFF' },
  { threshold: 5, discountPercent: 10, codeSuffix: '10', label: '10% OFF' },
  { threshold: 10, discountPercent: 15, codeSuffix: '15', label: '15% OFF' },
  { threshold: 15, discountPercent: 25, codeSuffix: '25', label: '25% OFF' },
]

export function generateReferralPromoCode(telegramUserId: number, tier: RewardTier): string {
  const randomSuffix = generateRandomSuffix(4)
  return `REF${tier.codeSuffix}_${telegramUserId.toString().slice(-4)}_${randomSuffix}`
}

export async function processAndCheckRewards(
  db: FirebaseFirestore.Firestore,
  telegramUserId: number,
  referralCount: number,
): Promise<RewardMilestone[]> {
  const rewardsDocRef = db.collection('referralRewards').doc(String(telegramUserId))

  try {
    // Grant any newly reached tiers inside one transaction so a code can never
    // be issued twice (getReferralInfo runs on every Rewards visit).
    await db.runTransaction(async (transaction) => {
      const rewardsSnapshot = await transaction.get(rewardsDocRef)
      const existingGrants = rewardsSnapshot.exists
        ? (rewardsSnapshot.data() as Record<string, unknown>)
        : {}

      const now = new Date()
      const grantedAt = now.toISOString()
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

      for (const tier of REFERRAL_MILESTONES) {
        const thresholdKey = String(tier.threshold)

        if (referralCount < tier.threshold) break
        const existingGrant = existingGrants[thresholdKey] as
          | { promoCode?: unknown; promoCodeId?: unknown }
          | undefined
        if (
          existingGrant &&
          typeof existingGrant.promoCode === 'string' &&
          existingGrant.promoCode.length > 0
        ) {
          continue
        }

        const promoCode = generateReferralPromoCode(telegramUserId, tier)
        const promoCodeRef = db.collection('promoCodes').doc()

        // Write the promo code (same shape checkout validates against)
        transaction.set(promoCodeRef, {
          code: promoCode,
          discountType: 'percentage',
          discountValue: tier.discountPercent,
          isActive: true,
          expiresAt: new Date(expiresAt.getTime()),
          usageLimit: 1,
          usageCount: 0,
          createdAt: now.toISOString(),
        })

        // Persist the grant so it is never granted twice
        transaction.set(
          rewardsDocRef,
          {
            [thresholdKey]: {
              promoCode,
              promoCodeId: promoCodeRef.id,
              grantedAt,
            },
          },
          { merge: true },
        )
      }
    })
  } catch (error) {
    console.error('processAndCheckRewards failed', error)
    // Don't fail the whole request — fall through and return current grants.
  }

  // Read back the grants to build the milestone response (granted + locked tiers)
  let grants: Record<string, { promoCode?: unknown; promoCodeId?: unknown }> = {}
  try {
    const rewardsSnapshot = await rewardsDocRef.get()
    if (rewardsSnapshot.exists) {
      grants = rewardsSnapshot.data() as typeof grants
    }
  } catch (error) {
    console.error('processAndCheckRewards read-back failed', error)
  }

  return REFERRAL_MILESTONES.map((tier) => {
    const grant = grants[String(tier.threshold)]
    const promoCode =
      grant && typeof grant.promoCode === 'string' && grant.promoCode.length > 0
        ? grant.promoCode
        : ''
    const promoCodeId =
      grant && typeof grant.promoCodeId === 'string' && grant.promoCodeId.length > 0
        ? grant.promoCodeId
        : ''

    return {
      threshold: tier.threshold,
      discountPercent: tier.discountPercent,
      promoCode,
      promoCodeId,
      granted: promoCode.length > 0,
    }
  })
}

export type RewardMilestone = {
  threshold: number
  discountPercent: number
  promoCode: string
  promoCodeId: string
  granted: boolean
}
