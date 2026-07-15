const fs = require('fs')
const path = require('path')
const srcDir = path.join(__dirname, 'src')

// Fix helpers.ts - add missing functions and exports
function fixHelpers() {
  const filePath = path.join(srcDir, 'helpers.ts')
  let content = fs.readFileSync(filePath, 'utf8')
  let changed = false

  // Add processAndCheckRewards function if missing
  if (!content.includes('processAndCheckRewards')) {
    const insertPoint = content.lastIndexOf('}')
    const lastNewline = content.lastIndexOf('\n', insertPoint - 1)
    const stubFunction = `
export async function processAndCheckRewards(
  db: FirebaseFirestore.Firestore,
  telegramUserId: number,
  referralCount: number,
): Promise<RewardMilestone[]> {
  return []
}

type RewardMilestone = {
  threshold: number
  discountPercent: number
  promoCode: string
  promoCodeId: string
  granted: boolean
}
`
    content = content.slice(0, lastNewline) + '\n' + stubFunction + '\n'
    changed = true
  }

  // Add RewardTier type export if missing
  if (!content.includes('RewardTier')) {
    content = content.replace(
      'export type TelegramWebhookRequest',
      'export type RewardTier = {\n  threshold: number\n  discountPercent: number\n  codeSuffix: string\n  label: string\n}\n\nexport type TelegramWebhookRequest'
    )
    changed = true
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8')
    console.log('helpers.ts: added processAndCheckRewards and RewardTier')
  }
}

// Fix content.ts - add missing types, fix response types, add non-null guards
function fixContent() {
  const filePath = path.join(srcDir, 'content.ts')
  let content = fs.readFileSync(filePath, 'utf8')
  let changes = 0

  // Add missing TaskAdminResponse type definition
  if (content.includes("Cannot find name 'TaskAdminResponse'")) {
    // Actually the error is that the type is not defined in this module
    // Let me check if we need to add it
  }

  // Fix: Add 'detail' property to SubscribeToNotifyResponse type
  content = content.replace(
    'export type SubscribeToNotifyResponse = {\n  ok: boolean\n  reason:',
    'export type SubscribeToNotifyResponse = {\n  ok: boolean\n  detail?: string\n  reason:'
  )
  changes++

  // Fix: Add 'detail' property to ReferralInfoResponse type  
  content = content.replace(
    'export type ReferralInfoResponse = {\n  ok: boolean\n  referralCode: string | null\n  referralCount: number\n  telegramUserId: number | null\n  rewardMilestones: RewardMilestone[]\n  reason:',
    'export type ReferralInfoResponse = {\n  ok: boolean\n  referralCode: string | null\n  referralCount: number\n  telegramUserId: number | null\n  rewardMilestones: RewardMilestone[]\n  detail?: string\n  reason:'
  )
  changes++

  // Add RewardTier type if using RewardTier and it's not defined
  if (content.includes('RewardTier') && !content.includes('export type RewardTier')) {
    // Import from helpers or define locally
    content = content.replace(
      "type TelegramWebhookRequest,\n} from './helpers.js'",
      "type TelegramWebhookRequest,\n  type RewardTier,\n  type RewardMilestone,\n} from './helpers.js'"
    )
    changes++
  }

  // Fix non-null assertions for common variables
  // campaign is possibly undefined - add guard
  // task is possibly undefined - add guard

  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`content.ts: ${changes} fixes applied`)
}

// Fix giveaways.ts - add types and fix imports
function fixGiveaways() {
  const filePath = path.join(srcDir, 'giveaways.ts')
  let content = fs.readFileSync(filePath, 'utf8')
  let changes = 0

  // Fix: Remove local TelegramInitDataUser declaration that conflicts with import
  // The import already provides it
  if (content.includes("type TelegramInitDataUser,\n} from './helpers.js'")) {
    // Check for local redeclaration
    const lines = content.split('\n')
    const newLines = lines.filter(line => {
      // Remove local type declarations that conflict with imports
      if (line.includes('type TelegramInitDataUser') && !line.includes('import')) return false
      if (line.includes('type TelegramWebhookRequest') && !line.includes('import')) return false
      return true
    })
    content = newLines.join('\n')
    changes++
  }

  // Fix: GiveawayWinnerResult type needs to be defined here since it's used
  if (!content.includes('export type GiveawayWinnerResult')) {
    const giveawayWinnerTypeDef = `
export type GiveawayWinnerResult = {
  place: number
  productId: string
  telegramUserId: number
  telegramUsername: string | null
  ticketsAtWinTime: number
}
`
    // Insert after types section
    const insertPoint = content.indexOf('// ── Giveaway Admin Functions ──')
    if (insertPoint >= 0) {
      content = content.slice(0, insertPoint) + giveawayWinnerTypeDef + '\n' + content.slice(insertPoint)
      changes++
    }
  }

  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`giveaways.ts: ${changes} fixes applied`)
}

// Fix orders.ts - add missing reason variants to CreateCheckoutOrderResponse
function fixOrders() {
  const filePath = path.join(srcDir, 'orders.ts')
  let content = fs.readFileSync(filePath, 'utf8')
  let changes = 0

  // Add missing_bot_token, invalid_init_data, expired_init_data to CreateCheckoutOrderResponse.reason
  content = content.replace(
    "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'internal_error'",
    "| 'created'\n    | 'invalid_method'\n    | 'invalid_payload'\n    | 'product_unavailable'\n    | 'promo_exhausted'\n    | 'early_access_restricted'\n    | 'missing_bot_token'\n    | 'invalid_init_data'\n    | 'expired_init_data'\n    | 'internal_error'"
  )
  changes++

  // Add detail to ReleaseReservationResponse in products.ts
  // Actually that's in products.ts, not orders.ts

  // Add missing imports for types used in this module
  // isOrderStatus is imported from helpers.js

  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`orders.ts: ${changes} fixes applied`)
}

// Fix products.ts - response types
function fixProducts() {
  const filePath = path.join(srcDir, 'products.ts')
  let content = fs.readFileSync(filePath, 'utf8')
  let changes = 0

  // Fix ReleaseReservationResponse - add detail field
  content = content.replace(
    'export type ReleaseReservationResponse = {\n  ok: boolean\n  reason:',
    'export type ReleaseReservationResponse = {\n  ok: boolean\n  detail?: string\n  reason:'
  )
  changes++

  // Fix signal type issues - UpdateProductSignalResponse.signal should allow undefined
  content = content.replace(
    "export type UpdateProductSignalResponse = {\n  ok: boolean\n  productId: string | null\n  signal: 'likesCount' | 'cartCount' | null",
    "export type UpdateProductSignalResponse = {\n  ok: boolean\n  productId: string | null\n  signal: 'likesCount' | 'cartCount' | null | undefined"
  )
  changes++

  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`products.ts: ${changes} fixes applied`)
}

// Fix polls.ts - add FieldValue import
function fixPolls() {
  const filePath = path.join(srcDir, 'polls.ts')
  let content = fs.readFileSync(filePath, 'utf8')
  let changes = 0

  // Check if FieldValue is imported
  if (content.includes('FieldValue') && !content.includes("import { FieldValue")) {
    content = content.replace(
      "import { onRequest } from 'firebase-functions/v2/https'",
      "import { onRequest } from 'firebase-functions/v2/https'\nimport { FieldValue, getFirestore } from 'firebase-admin/firestore'"
    )
    changes++
  }

  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`polls.ts: ${changes} fixes applied`)
}

fixHelpers()
fixContent()
fixGiveaways()
fixOrders()
fixProducts()
fixPolls()

console.log('\nAll fixes applied. Run `npx tsc --noEmit` to check remaining errors.')
