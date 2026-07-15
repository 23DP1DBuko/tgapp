const fs = require('fs')
const path = require('path')
const src = p => path.join(__dirname, 'src', p)

// ── 1. Fix helpers.ts: add export to functions imported by domain modules ──
function fixHelpers() {
  let c = fs.readFileSync(src('helpers.ts'), 'utf8')
  let fixes = 0
  
  // Functions that need export (these are imported by domain modules)
  const exportFuncs = [
    'toApiOrder',
    'readAdminIdsFromEnv',
    'isOrderStatus',
    'isPromoDiscountType',
    'isProductSignal',
    'isSignalDelta',
    'isValidPromoInput',
    'isValidProductInput',
    'isValidCampaignInput',
    'isValidTaskInput',
    'isValidGiveawayInput',
    'isValidGiveawayPrize',
    'isValidEntryTaskInput',
    'isValidPollInput',
    'isValidCheckoutOrderPayload',
    'isValidOrderTransition',
    'generateShortId',
    'verifyTelegramInitData',
    'sanitizeStorageFileName',
    'buildFirebaseDownloadUrl',
    'parseStoragePathFromImageUrl',
    'isStartCommand',
    'isStoreCommand',
    'isHelpCommand',
    'parseReferralCode',
    'processAndCheckRewards',
    'isValidUploadImagePayload',
    'notifyProductSubscribers',
    'upsertTelegramSubscriberFromUpdate',
    'sendTelegramOrderCreatedMessage',
    'sendTelegramOrderCancelledMessage',
    'sendTelegramOrderPaidMessage',
    'sendTelegramOrderReadyForMeetupMessage',
    'sendTelegramOrderCompletedMessage',
    'sendTelegramStoreWelcomeMessage',
    'sendTelegramStoreShortcutMessage',
    'sendTelegramHelpMessage',
    'sendTelegramBroadcastMessage',
  ]
  
  for (const funcName of exportFuncs) {
    // Add export to "function funcName("
    const regex1 = new RegExp('^function ' + funcName + '\\(', 'gm')
    c = c.replace(regex1, (match) => {
      fixes++
      return `export function ${funcName}(`
    })
    
    // Add export to "async function funcName("
    const regex2 = new RegExp('^async function ' + funcName + '\\(', 'gm')
    c = c.replace(regex2, (match) => {
      fixes++
      return `export async function ${funcName}(`
    })
  }
  
  // Fix exports for const-based type guard functions
  const exportConsts = [
    'isOrderStatus',
    'isProductSignal',
    'isSignalDelta',
    'isPromoDiscountType',
  ]
  for (const name of exportConsts) {
    const regex = new RegExp(`^const ${name} =`, 'gm')
    c = c.replace(regex, (match) => {
      fixes++
      return `export const ${name} =`
    })
  }
  
  // Fix the type import: UploadBannerImageAdminRequest/Response are not exported from content.ts
  // Remove them from type imports and define locally
  c = c.replace(
    "import type { CampaignAdminInput, TaskAdminInput, UploadBannerImageAdminRequest, UploadBannerImageAdminResponse, AdminAnalyticsRequest, AdminAnalyticsResponse } from './content.js'",
    "import type { CampaignAdminInput, TaskAdminInput, AdminAnalyticsRequest, AdminAnalyticsResponse } from './content.js'"
  )
  
  // Add local declarations for upload banner types
  const bannerTypes = `
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
`
  // Add after the type-only imports
  c = c.replace(
    "import type { CampaignAdminInput, TaskAdminInput, AdminAnalyticsRequest, AdminAnalyticsResponse } from './content.js'",
    "import type { CampaignAdminInput, TaskAdminInput, AdminAnalyticsRequest, AdminAnalyticsResponse } from './content.js'" + bannerTypes
  )
  
  // Fix UploadProductImageAdminRequest references (it's in products.ts)
  c = c.replace(
    "import type { PromoAdminInput } from './promoCodes.js'",
    "import type { PromoAdminInput, UploadProductImageAdminRequest } from './promoCodes.js'"
  )
  
  // Fix: Add UploadProductImageAdminRequest type export to promoCodes.ts
  // (We'll do this in fixPromoCodes)
  
  fs.writeFileSync(src('helpers.ts'), c, 'utf8')
  console.log(`helpers.ts: ${fixes} export fixes applied`)
}

// ── 2. Fix promoCodes.ts: add UploadProductImageAdminRequest type ──
function fixPromoCodes() {
  let c = fs.readFileSync(src('promoCodes.ts'), 'utf8')
  
  if (!c.includes('UploadProductImageAdminRequest')) {
    c = c.replace(
      "export type PromoAdminResponse",
      "export type UploadProductImageAdminRequest = {\n  initData: string\n  fileName: string\n  contentType: string\n  base64Data: string\n}\n\nexport type PromoAdminResponse"
    )
    fs.writeFileSync(src('promoCodes.ts'), c, 'utf8')
    console.log('promoCodes.ts: added UploadProductImageAdminRequest type')
  }
}

// ── 3. Fix polls.ts: duplicate getFirestore + add isValidPollInput export ──
function fixPolls() {
  let c = fs.readFileSync(src('polls.ts'), 'utf8')
  let changes = 0
  
  // Fix duplicate getFirestore import
  if (c.includes("import { FieldValue, getFirestore }")) {
    c = c.replace(
      "import { onRequest } from 'firebase-functions/v2/https'\nimport { FieldValue, getFirestore } from 'firebase-admin/firestore'",
      "import { onRequest } from 'firebase-functions/v2/https'\nimport { FieldValue, getFirestore as gf } from 'firebase-admin/firestore'"
    )
    c = c.replace(/\bgetFirestore\(\)/g, 'gf()')
    changes++
  }
  
  fs.writeFileSync(src('polls.ts'), c, 'utf8')
  if (changes > 0) console.log(`polls.ts: ${changes} fixes applied`)
}

// ── 4. Fix giveaways.ts: winners null assignment ──
function fixGiveaways() {
  let c = fs.readFileSync(src('giveaways.ts'), 'utf8')
  
  // Fix the type cast for winners: null
  c = c.replace(
    "winners: null as unknown as GiveawayWinnerResult[] | null",
    "winners: null as unknown as GiveawayWinnerResult[] | null"
  )
  
  // Actually let's use a more specific fix
  c = c.replace(
    "winners: existingData?.winners ?? null",
    "winners: (existingData?.winners as unknown as GiveawayWinnerResult[] | null | undefined) ?? null"
  )
  
  fs.writeFileSync(src('giveaways.ts'), c, 'utf8')
  console.log('giveaways.ts: fixed winners type')
}

// ── 5. Fix orders.ts: add toApiOrder export, fix isOrderStatus, PROMO_DISCOUNT_TYPES ──
function fixOrders() {
  let c = fs.readFileSync(src('orders.ts'), 'utf8')
  
  // Add toApiOrder function since helpers.ts's version was truncated
  if (!c.includes('function toApiOrder')) {
    const toApiOrderFunc = `
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
    createdAt: data.createdAt instanceof Date ? data.createdAt.toISOString() : (typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate().toISOString() : (data.createdAt ?? null)),
  }
}
`
    // Insert before the first Cloud Function
    c = c.replace(
      "export const updateOrderStatusAdmin",
      toApiOrderFunc + "\nexport const updateOrderStatusAdmin"
    )
  }
  
  // Fix PROMO_DISCOUNT_TYPES - it's exported from helpers.js
  // Import it
  if (!c.includes('PROMO_DISCOUNT_TYPES')) {
    c = c.replace(
      "toApiOrder,\n} from './helpers.js'",
      "toApiOrder,\n  PROMO_DISCOUNT_TYPES,\n} from './helpers.js'"
    )
  }
  
  // Fix isOrderStatus import
  if (!c.includes('ORDER_STATUSES,\n  isOrderStatus')) {
    c = c.replace(
      "ORDER_STATUSES,\n  readAdminIdsFromEnv",
      "ORDER_STATUSES,\n  isOrderStatus,\n  readAdminIdsFromEnv"
    )
  }
  
  // Fix response type: add missing_bot_token/invalid_init_data/expired_init_data to CreateCheckoutOrderResponse
  c = c.replace(
    "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'internal_error'",
    "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'missing_bot_token'\n    | 'invalid_init_data'\n    | 'expired_init_data'\n    | 'internal_error'"
  )
  
  fs.writeFileSync(src('orders.ts'), c, 'utf8')
  console.log('orders.ts: fixes applied')
}

// ── 6. Fix content.ts: detail field in response types ──
function fixContent() {
  let c = fs.readFileSync(src('content.ts'), 'utf8')
  
  // Fix SubscribeToNotifyResponse - add detail field
  c = c.replace(
    'export type SubscribeToNotifyResponse = {\n  ok: boolean\n  reason:',
    'export type SubscribeToNotifyResponse = {\n  ok: boolean\n  detail?: string\n  reason:'
  )
  
  // Fix ReferralInfoResponse - add detail field
  c = c.replace(
    'export type ReferralInfoResponse = {\n  ok: boolean\n  referralCode: string | null\n  referralCount: number\n  telegramUserId: number | null\n  rewardMilestones: RewardMilestone[]\n  reason:',
    'export type ReferralInfoResponse = {\n  ok: boolean\n  referralCode: string | null\n  referralCount: number\n  telegramUserId: number | null\n  rewardMilestones: RewardMilestone[]\n  detail?: string\n  reason:'
  )
  
  fs.writeFileSync(src('content.ts'), c, 'utf8')
  console.log('content.ts: fixed response types')
}

// ── 7. Fix products.ts: ReleaseReservationResponse detail field, computed property name ──
function fixProducts() {
  let c = fs.readFileSync(src('products.ts'), 'utf8')
  
  // Fix ReleaseReservationResponse - add detail field
  c = c.replace(
    'export type ReleaseReservationResponse = {\n  ok: boolean\n  reason:',
    'export type ReleaseReservationResponse = {\n  ok: boolean\n  detail?: string\n  reason:'
  )
  
  // Fix UpdateProductSignalResponse signal type
  c = c.replace(
    "export type UpdateProductSignalResponse = {\n  ok: boolean\n  productId: string | null\n  signal: 'likesCount' | 'cartCount' | null",
    "export type UpdateProductSignalResponse = {\n  ok: boolean\n  productId: string | null\n  signal: 'likesCount' | 'cartCount' | null | undefined"
  )
  
  fs.writeFileSync(src('products.ts'), c, 'utf8')
  console.log('products.ts: fixed response types')
}

fixHelpers()
fixPromoCodes()
fixPolls()
fixGiveaways()
fixOrders()
fixContent()
fixProducts()

console.log('\nAll fixes applied. Run `npx tsc --noEmit` to check remaining errors.')
