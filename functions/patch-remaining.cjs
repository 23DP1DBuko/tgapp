const fs = require('fs')
const path = require('path')
const dir = p => path.join(__dirname, 'src', p)

function read(f) { return fs.readFileSync(dir(f), 'utf8') }
function write(f, c) { fs.writeFileSync(dir(f), c, 'utf8') }

// 1. helpers.ts: add isValidPollInput with proper types, ensure toApiOrder is exported
let h = read('helpers.ts')
let hFixes = 0

// Find toApiOrder and ensure it's exported
if (h.includes('function toApiOrder(') && !h.includes('export function toApiOrder(')) {
  h = h.replace('function toApiOrder(', 'export function toApiOrder(')
  hFixes++
}

// Add isValidPollInput if it doesn't exist
if (!h.includes('function isValidPollInput(')) {
  // Find the right place - after the last validation function
  h = h.replace(
    'export function isValidPromoInput(value: unknown): value is PromoAdminInput',
    'export function isValidPollInput(value: unknown): value is Record<string, unknown> {\n  if (!value || typeof value !== \'object\') return false\n  const p = value as Partial<{ title?: unknown; options?: unknown; isActive?: unknown }>\n  return typeof p.title === \'string\' && Array.isArray(p.options) && typeof p.isActive === \'boolean\'\n}\n\nexport function isValidPromoInput(value: unknown): value is PromoAdminInput'
  )
  hFixes++
}
write('helpers.ts', h)
if (hFixes > 0) console.log('helpers.ts:', hFixes, 'fixes')

// 2. content.ts: fix response types
let cnt = read('content.ts')
let cntFixes = 0
// The 'detail' field not being recognized suggests the fix script didn't match the exact string
// Let me check what the actual type definition looks like
if (cnt.includes("detail?: string\n  reason:") && cnt.includes("export type SubscribeToNotifyResponse")) {
  // Already fixed
} else if (!cnt.includes("detail?: string")) {
  // Fix SubscribeToNotifyResponse
  cnt = cnt.replace(
    'export type SubscribeToNotifyResponse = {\n  ok: boolean\n  reason:',
    'export type SubscribeToNotifyResponse = {\n  ok: boolean\n  detail?: string\n  reason:'
  )
  cntFixes++
}
if (!cnt.includes("detail?: string\n  reason:\n    | 'listed'") && cnt.includes("ReferralInfoResponse")) {
  cnt = cnt.replace(
    'export type ReferralInfoResponse = {\n  ok: boolean\n  referralCode: string | null\n  referralCount: number\n  telegramUserId: number | null\n  rewardMilestones: RewardMilestone[]\n  reason:',
    'export type ReferralInfoResponse = {\n  ok: boolean\n  referralCode: string | null\n  referralCount: number\n  telegramUserId: number | null\n  rewardMilestones: RewardMilestone[]\n  detail?: string\n  reason:'
  )
  cntFixes++
}
write('content.ts', cnt)
if (cntFixes > 0) console.log('content.ts:', cntFixes, 'fixes')

// 3. giveaways.ts: fix winners null type
let g = read('giveaways.ts')
let gFixes = 0
g = g.replace("winners: undefined,", "winners: null,")
g = g.replace(
  "winners: existingData?.winners ?? null",
  "winners: (existingData?.winners as GiveawayWinnerResult[] | null | undefined) ?? null"
)
gFixes++
write('giveaways.ts', g)
if (gFixes > 0) console.log('giveaways.ts:', gFixes, 'fixes')

// 4. orders.ts: fix imports and response types
let o = read('orders.ts')
let oFixes = 0

// Add toApiOrder import
const helpersImportMatch = o.match(/from '\.\/helpers\.js'/)
if (helpersImportMatch) {
  const importBlock = o.substring(0, helpersImportMatch.index)
  if (!importBlock.includes('toApiOrder')) {
    // Find the closing } of the import block and add toApiOrder
    o = o.replace(
      /} from '\.\/helpers\.js'/,
      `  toApiOrder,\n} from './helpers.js'`
    )
    oFixes++
  }
}

// Add PROMO_DISCOUNT_TYPES import
if (!o.includes('PROMO_DISCOUNT_TYPES')) {
  o = o.replace(
    /} from '\.\/helpers\.js'/,
    `  PROMO_DISCOUNT_TYPES,\n} from './helpers.js'`
  )
  oFixes++
}

// Fix CreateCheckoutOrderResponse reason
o = o.replace(
  "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'internal_error'",
  "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'missing_bot_token'\n    | 'invalid_init_data'\n    | 'expired_init_data'\n    | 'internal_error'"
)
oFixes++

write('orders.ts', o)
if (oFixes > 0) console.log('orders.ts:', oFixes, 'fixes')

// 5. polls.ts: fix import conflict and add non-null assertion for poll
let p = read('polls.ts')
let pFixes = 0

// Fix the getFirestore duplicate - use gf alias instead
p = p.replace("import { FieldValue, getFirestore as gf } from 'firebase-admin/firestore'", "import { FieldValue, getFirestore } from 'firebase-admin/firestore'")

// The old gf() calls need to go back to getFirestore()
p = p.replace(/\bgf\(\)/g, 'getFirestore()')

// Add ! to poll access
p = p.replace(/poll\.options/g, 'poll!.options')
p = p.replace(/poll\.title/g, 'poll!.title')
p = p.replace(/poll\.isActive/g, 'poll!.isActive')
pFixes++

write('polls.ts', p)
if (pFixes > 0) console.log('polls.ts:', pFixes, 'fixes')

// 6. products.ts: fix ReleaseReservationResponse
let pr = read('products.ts')
let prFixes = 0
pr = pr.replace(
  'export type ReleaseReservationResponse = {\n  ok: boolean\n  reason:',
  'export type ReleaseReservationResponse = {\n  ok: boolean\n  detail?: string\n  reason:'
)
prFixes++

// Fix UpdateProductSignalResponse signal type
pr = pr.replace(
  "export type UpdateProductSignalResponse = {\n  ok: boolean\n  productId: string | null\n  signal: 'likesCount' | 'cartCount' | null",
  "export type UpdateProductSignalResponse = {\n  ok: boolean\n  productId: string | null\n  signal: 'likesCount' | 'cartCount' | null | undefined"
)
prFixes++

write('products.ts', pr)
if (prFixes > 0) console.log('products.ts:', prFixes, 'fixes')

console.log('\nDone patching!')
